import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { LogLevel } from '@logs/shared';

export interface BufferedRow {
  ts: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata: string | null; // JSON-stringified, cast to jsonb on insert
  traceId: string | null;
  apiKeyId: number | null;
}

/**
 * Batches inserts into a single multi-row `unnest` statement instead of one
 * INSERT per log. Flushes on a timer or once the batch reaches
 * WRITE_FLUSH_ROWS, whichever comes first. The swap of `this.rows` into a
 * local `batch` at the top of `flush()` happens synchronously (no `await`
 * before it), so concurrent triggers to flush can never interleave or lose
 * rows - this is a queue, not a lock.
 */
class WriteBuffer {
  private rows: BufferedRow[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private droppedTotalCount = 0;

  /** Returns false if the buffer is full and the row was dropped. */
  push(row: BufferedRow): boolean {
    if (this.rows.length >= config.MAX_BUFFER_ROWS) {
      this.droppedTotalCount++;
      return false;
    }
    this.rows.push(row);
    if (this.rows.length >= config.WRITE_FLUSH_ROWS) {
      void this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => void this.flush(), config.WRITE_FLUSH_MS);
      this.flushTimer.unref?.();
    }
    return true;
  }

  get droppedTotal(): number {
    return this.droppedTotalCount;
  }

  get pendingCount(): number {
    return this.rows.length;
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.rows.length === 0) return;
    const batch = this.rows;
    this.rows = [];
    try {
      await this.insertBatch(batch);
    } catch (err) {
      logger.error({ err, size: batch.length }, 'Fallo al escribir el lote de logs en Postgres');
    }
  }

  private async insertBatch(batch: BufferedRow[]): Promise<void> {
    const ts: string[] = [];
    const level: string[] = [];
    const service: string[] = [];
    const message: string[] = [];
    const metadata: (string | null)[] = [];
    const traceId: (string | null)[] = [];
    const apiKeyId: (number | null)[] = [];

    for (const row of batch) {
      ts.push(row.ts);
      level.push(row.level);
      service.push(row.service);
      message.push(row.message);
      metadata.push(row.metadata);
      traceId.push(row.traceId);
      apiKeyId.push(row.apiKeyId);
    }

    await pool.query(
      `INSERT INTO logs (ts, level, service, message, metadata, trace_id, api_key_id)
       SELECT * FROM unnest(
         $1::timestamptz[], $2::log_level[], $3::text[], $4::text[],
         $5::jsonb[], $6::text[], $7::bigint[]
       )`,
      [ts, level, service, message, metadata, traceId, apiKeyId],
    );
  }
}

export const writeBuffer = new WriteBuffer();
