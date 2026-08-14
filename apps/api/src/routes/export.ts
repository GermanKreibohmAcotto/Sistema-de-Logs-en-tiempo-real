import { Transform } from 'node:stream';
import type { FastifyPluginAsync } from 'fastify';
import QueryStream from 'pg-query-stream';
import { exportQuerySchema, type ExportFormat } from '@logs/shared';
import { pool } from '../db/pool.js';
import { buildWhereClause } from '../db/filter-sql.js';
import { rowToLogEvent, type LogRow } from '../db/row-mapping.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { csvEscape } from '../export/csv.js';

function contentTypeFor(format: ExportFormat): string {
  if (format === 'csv') return 'text/csv; charset=utf-8';
  if (format === 'ndjson') return 'application/x-ndjson; charset=utf-8';
  return 'application/json; charset=utf-8';
}

function extensionFor(format: ExportFormat): string {
  if (format === 'csv') return 'csv';
  if (format === 'ndjson') return 'ndjson';
  return 'json';
}

/**
 * Streaming export: pg-query-stream cursors rows out of Postgres in
 * batches and pipes straight into the HTTP response. The full result set
 * is never materialized in memory, so this scales the same way whether the
 * filtered result is 500 rows or EXPORT_MAX_ROWS.
 */
export const exportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/logs/export', async (request, reply) => {
    const parsed = exportQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }
    const { format, ...filters } = parsed.data;
    const { where, params } = buildWhereClause(filters);

    const sql = `
      SELECT id, ts, level, service, message, metadata, trace_id, ingested_at
      FROM logs
      ${where}
      ORDER BY ts DESC, id DESC
      LIMIT ${config.EXPORT_MAX_ROWS}
    `;

    const client = await pool.connect();
    const dbStream = client.query(new QueryStream(sql, params, { batchSize: 500 }));

    let isFirstRow = true;
    const transform = new Transform({
      writableObjectMode: true,
      readableObjectMode: false,
      transform(row: LogRow, _enc, callback) {
        const event = rowToLogEvent(row);
        if (format === 'csv') {
          if (isFirstRow) this.push('timestamp,level,service,message,traceId,metadata\n');
          const line = [
            event.timestamp,
            event.level,
            event.service,
            event.message,
            event.traceId ?? '',
            event.metadata ? JSON.stringify(event.metadata) : '',
          ]
            .map((v) => csvEscape(String(v)))
            .join(',');
          this.push(line + '\n');
        } else if (format === 'ndjson') {
          this.push(JSON.stringify(event) + '\n');
        } else {
          this.push((isFirstRow ? '[' : ',') + JSON.stringify(event));
        }
        isFirstRow = false;
        callback();
      },
      flush(callback) {
        if (format === 'json') this.push(isFirstRow ? '[]' : ']');
        callback();
      },
    });

    dbStream.on('error', (err: Error) => {
      logger.error({ err }, 'Error en el stream de exportacion');
      transform.destroy(err);
    });
    transform.on('close', () => client.release());

    dbStream.pipe(transform);

    reply.header(
      'Content-Disposition',
      `attachment; filename="logs-export-${Date.now()}.${extensionFor(format)}"`,
    );
    reply.type(contentTypeFor(format));
    return reply.send(transform);
  });
};
