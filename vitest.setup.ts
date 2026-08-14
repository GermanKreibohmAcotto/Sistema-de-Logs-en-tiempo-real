// Runs before every test file. apps/api/src/config.ts validates process.env
// at import time and calls process.exit(1) if DATABASE_URL/REDIS_URL are
// missing - that would take down the whole test run the moment any module
// transitively imports config.ts, even in test files that only need a pure
// function. Seeding safe defaults here (only if unset) means: unit tests
// that mock their way around real I/O never touch these, and integration
// tests get a `logs_test` database / a separate Redis logical DB so they
// never collide with a developer's local `logs` database.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://logs:logs@localhost:5432/logs_test';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
