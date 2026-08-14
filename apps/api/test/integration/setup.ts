import pg from 'pg';
import { config } from '../../src/config.js';
import { runMigrations } from '../../src/db/migrate.js';

/**
 * Integration tests run against real Postgres/Redis (see vitest.setup.ts for
 * the `logs_test` / redis db 1 defaults) so they can only run where those
 * are reachable - e.g. not in this sandbox until Docker Desktop's
 * virtualization block is resolved. `isStackReachable()` lets each suite
 * skip itself cleanly instead of crashing the whole test run.
 */
export async function isStackReachable(): Promise<boolean> {
  // Connect to the admin database, not config.DATABASE_URL directly -
  // `logs_test` does not exist yet on a fresh Postgres instance (that's
  // what ensureTestDatabase() is for, and it runs after this check), so
  // testing reachability against the target database itself would always
  // report "unreachable" on a first run and skip the whole suite.
  const client = new pg.Client({ connectionString: adminConnectionString(), connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      // already closed/never opened
    }
    return false;
  }
}

function adminConnectionString(): string {
  const url = new URL(config.DATABASE_URL);
  url.pathname = '/postgres';
  return url.toString();
}

function targetDatabaseName(): string {
  const url = new URL(config.DATABASE_URL);
  return url.pathname.replace(/^\//, '');
}

let ensured = false;

// Arbitrary fixed key: Vitest runs test files in separate isolated module
// registries (each integration file gets its own `ensured` flag, its own
// `pool`), so a plain in-process guard cannot prevent concurrently-running
// files from racing on CREATE DATABASE / migrations against the *same*
// logs_test database. A Postgres advisory lock serializes just this setup
// section across processes/workers without forcing the whole test suite
// to run single-threaded.
const SETUP_LOCK_KEY = 727384910;

async function withAdvisoryLock<T>(client: pg.Client, fn: () => Promise<T>): Promise<T> {
  await client.query('SELECT pg_advisory_lock($1)', [SETUP_LOCK_KEY]);
  try {
    return await fn();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SETUP_LOCK_KEY]);
  }
}

/** Creates the `logs_test` database if missing and applies migrations. Idempotent and safe under concurrent callers. */
export async function ensureTestDatabase(): Promise<void> {
  if (ensured) return;

  const admin = new pg.Client({ connectionString: adminConnectionString() });
  await admin.connect();
  try {
    await withAdvisoryLock(admin, async () => {
      const dbName = targetDatabaseName();
      const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (rowCount === 0) {
        await admin.query(`CREATE DATABASE "${dbName}"`);
      }
    });
  } finally {
    await admin.end();
  }

  // Migrations run against the target database itself, so the advisory
  // lock here is taken on a separate connection to logs_test - concurrent
  // callers block on this lock instead of racing CREATE TABLE statements
  // that aren't individually idempotent.
  const migrationLock = new pg.Client({ connectionString: config.DATABASE_URL });
  await migrationLock.connect();
  try {
    await withAdvisoryLock(migrationLock, () => runMigrations());
  } finally {
    await migrationLock.end();
  }

  ensured = true;
}
