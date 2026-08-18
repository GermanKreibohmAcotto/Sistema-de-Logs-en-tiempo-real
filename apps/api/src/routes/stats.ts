import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { logQuerySchema, LOG_LEVELS, type StatsBucket } from '@logs/shared';
import { pool } from '../db/pool.js';
import { buildWhereClause } from '../db/filter-sql.js';

const timeseriesQuerySchema = logQuerySchema.extend({
  bucketSeconds: z.coerce.number().int().min(10).max(3600).default(60),
});

function emptyCounts(): StatsBucket['counts'] {
  const counts = {} as StatsBucket['counts'];
  for (const level of LOG_LEVELS) counts[level] = 0;
  return counts;
}

/** Historical timeseries for events-per-minute, backing the initial chart load and the Historical view mode. */
export const statsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/stats/timeseries', async (request, reply) => {
    const parsed = timeseriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
    }
    const { bucketSeconds, ...rest } = parsed.data;
    const from = rest.from ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = rest.to ?? new Date().toISOString();
    const filters = { ...rest, from, to };

    const { where, params } = buildWhereClause(filters);
    const bucketParamIndex = params.length + 1;
    params.push(`${bucketSeconds} seconds`);

    const { rows } = await pool.query<{ bucket_start: Date; level: string; count: number }>(
      `SELECT date_bin($${bucketParamIndex}::interval, ts, TIMESTAMPTZ 'epoch') AS bucket_start,
              level,
              COUNT(*)::int AS count
       FROM logs
       ${where}
       GROUP BY bucket_start, level
       ORDER BY bucket_start ASC`,
      params,
    );

    const byBucket = new Map<string, StatsBucket>();
    for (const row of rows) {
      const key = row.bucket_start.toISOString();
      let bucket = byBucket.get(key);
      if (!bucket) {
        bucket = { bucketStart: key, counts: emptyCounts() };
        byBucket.set(key, bucket);
      }
      bucket.counts[row.level as keyof StatsBucket['counts']] = row.count;
    }

    const buckets = [...byBucket.values()].sort((a, b) =>
      a.bucketStart.localeCompare(b.bucketStart),
    );
    return { buckets };
  });
};
