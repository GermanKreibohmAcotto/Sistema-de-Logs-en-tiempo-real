import type { LogQuery } from '@logs/shared';

/**
 * Translates the shared LogQuery filter shape into a parameterized WHERE
 * clause. `message ILIKE $n` benefits from the GIN trigram index
 * (logs_message_trgm_idx) even with a leading wildcard, unlike a plain
 * btree index.
 */
export function buildWhereClause(
  filters: LogQuery,
  startParamIndex = 1,
): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = startParamIndex;

  if (filters.levels && filters.levels.length > 0) {
    params.push(filters.levels);
    conditions.push(`level = ANY($${idx}::log_level[])`);
    idx++;
  }
  if (filters.services && filters.services.length > 0) {
    params.push(filters.services);
    conditions.push(`service = ANY($${idx}::text[])`);
    idx++;
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    conditions.push(`message ILIKE $${idx}`);
    idx++;
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`ts >= $${idx}`);
    idx++;
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`ts <= $${idx}`);
    idx++;
  }

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}
