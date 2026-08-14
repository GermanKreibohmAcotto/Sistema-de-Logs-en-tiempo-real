import type { FastifyPluginAsync } from 'fastify';
import { logListQuerySchema, type LogQuery } from '@logs/shared';
import { pool } from '../db/pool.js';
import { buildWhereClause } from '../db/filter-sql.js';
import { rowToLogEvent, type LogRow } from '../db/row-mapping.js';

function encodeCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { ts: string; id: string } | null {
  try {
    const [ts, id] = Buffer.from(cursor, 'base64url').toString('utf-8').split('|');
    if (!ts || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

export const queryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/logs', async (request, reply) => {
    const parsed = logListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }
    const { cursor, limit, ...filters } = parsed.data;
    const { where, params } = buildWhereClause(filters as LogQuery);

    // Keyset pagination on the (ts, id) primary key: strictly more efficient
    // than OFFSET at depth, and stable while new rows keep arriving ahead of
    // the page.
    const conditions = where ? [where.slice('WHERE '.length)] : [];
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        params.push(decoded.ts, decoded.id);
        conditions.push(
          `(ts, id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`,
        );
      }
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const { rows } = await pool.query<LogRow>(
      `SELECT id, ts, level, service, message, metadata, trace_id, ingested_at
       FROM logs
       ${whereClause}
       ORDER BY ts DESC, id DESC
       LIMIT $${params.length}`,
      params,
    );

    const items = rows.map(rowToLogEvent);
    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last ? encodeCursor(last.ts.toISOString(), String(last.id)) : null;

    return { items, nextCursor };
  });
};
