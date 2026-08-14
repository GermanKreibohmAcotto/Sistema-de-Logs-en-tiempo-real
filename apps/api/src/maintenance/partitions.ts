import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

function fmtName(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const PARTITION_NAME_RE = /^logs_p_(\d{8})$/;

/**
 * Creates the daily partitions the ingest path needs (yesterday, to absorb
 * the +-24h clock-skew tolerance on client timestamps, through today +
 * PARTITION_LOOKAHEAD_DAYS) and drops partitions older than RETENTION_DAYS.
 * Safe to call repeatedly - partition creation is idempotent and dropping
 * only touches partitions strictly older than the cutoff.
 */
export async function ensurePartitions(): Promise<void> {
  const client = await pool.connect();
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = -1; i <= config.PARTITION_LOOKAHEAD_DAYS; i++) {
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() + i);
      const to = new Date(from);
      to.setUTCDate(to.getUTCDate() + 1);
      const name = `logs_p_${fmtName(from)}`;
      const fromDate = dateOnly(from);
      const toDate = dateOnly(to);
      // Postgres's extended query protocol does not support bind
      // parameters ($1/$2) in DDL - "CREATE TABLE ... PARTITION OF" is a
      // utility statement, not a plannable DML query, so the server always
      // reports it as requiring 0 parameters regardless of what the client
      // binds. fromDate/toDate are computed here (never user input) and
      // strictly YYYY-MM-DD, so interpolating them is safe.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        throw new Error(`Fecha de particion con formato inesperado: ${fromDate} / ${toDate}`);
      }
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF logs FOR VALUES FROM ('${fromDate}') TO ('${toDate}')`,
      );
    }

    const cutoff = new Date(today);
    cutoff.setUTCDate(cutoff.getUTCDate() - config.RETENTION_DAYS);

    const { rows } = await client.query<{ relname: string }>(
      `SELECT c.relname
         FROM pg_inherits i
         JOIN pg_class c ON c.oid = i.inhrelid
         JOIN pg_class p ON p.oid = i.inhparent
        WHERE p.relname = 'logs' AND c.relname LIKE 'logs\\_p\\_%'`,
    );

    for (const { relname } of rows) {
      const match = PARTITION_NAME_RE.exec(relname);
      if (!match?.[1]) continue;
      const raw = match[1];
      const partitionDate = new Date(
        Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8))),
      );
      if (partitionDate < cutoff) {
        logger.info({ partition: relname }, 'Eliminando particion vencida por retencion');
        await client.query(`DROP TABLE IF EXISTS ${relname}`);
      }
    }
  } finally {
    client.release();
  }
}

/** Runs ensurePartitions immediately and then once every 24h. */
export function schedulePartitionMaintenance(): () => void {
  ensurePartitions().catch((err) => logger.error({ err }, 'Fallo el mantenimiento de particiones'));
  const handle = setInterval(
    () => {
      ensurePartitions().catch((err) =>
        logger.error({ err }, 'Fallo el mantenimiento de particiones'),
      );
    },
    24 * 60 * 60 * 1000,
  );
  handle.unref();
  return () => clearInterval(handle);
}
