import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../db/pool.js';
import { redisCmd } from '../redis.js';
import { logger } from '../logger.js';

const KEY_PREFIX = 'lk_';
const CACHE_TTL_SECONDS = 60;
const CACHE_KEY_PREFIX = 'apikey:';

export interface ApiKeyRecord {
  id: number;
  name: string;
  rateLimitRpm: number;
}

export type ApiKeyLookup =
  { status: 'valid'; record: ApiKeyRecord } | { status: 'not_found' } | { status: 'revoked' };

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/** Generates a new key, returning the raw value (shown once) plus its DB row. */
export async function createApiKey(
  name: string,
  rateLimitRpm = 6000,
): Promise<{ rawKey: string; record: ApiKeyRecord }> {
  const secret = randomBytes(24).toString('hex');
  const rawKey = `${KEY_PREFIX}${secret}`;
  const keyPrefix = rawKey.slice(0, 8);
  const keyHash = hashKey(rawKey);

  const { rows } = await pool.query<{ id: number; name: string; rate_limit_rpm: number }>(
    `INSERT INTO api_keys (name, key_prefix, key_hash, rate_limit_rpm)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, rate_limit_rpm`,
    [name, keyPrefix, keyHash, rateLimitRpm],
  );
  const row = rows[0];
  if (!row) throw new Error('No se pudo crear la API key');

  return {
    rawKey,
    record: { id: row.id, name: row.name, rateLimitRpm: row.rate_limit_rpm },
  };
}

/**
 * Validates a raw API key header. Cache-first (Redis, 60s TTL) with
 * Postgres fallback, so the ingest hot path does not hit the database on
 * every request.
 */
export async function validateApiKey(rawKey: string): Promise<ApiKeyLookup> {
  const keyHash = hashKey(rawKey);
  const cacheKey = `${CACHE_KEY_PREFIX}${keyHash}`;

  try {
    const cached = await redisCmd.get(cacheKey);
    if (cached) return JSON.parse(cached) as ApiKeyLookup;
  } catch (err) {
    logger.warn({ err }, 'Fallo la lectura de cache de API keys, se usa Postgres');
  }

  const { rows } = await pool.query<{
    id: number;
    name: string;
    rate_limit_rpm: number;
    enabled: boolean;
    revoked_at: string | null;
  }>(`SELECT id, name, rate_limit_rpm, enabled, revoked_at FROM api_keys WHERE key_hash = $1`, [
    keyHash,
  ]);
  const row = rows[0];

  let result: ApiKeyLookup;
  if (!row) {
    result = { status: 'not_found' };
  } else if (row.revoked_at || !row.enabled) {
    result = { status: 'revoked' };
  } else {
    result = {
      status: 'valid',
      record: { id: row.id, name: row.name, rateLimitRpm: row.rate_limit_rpm },
    };
  }

  await redisCmd
    .set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS)
    .catch(() => undefined);

  if (result.status === 'valid') {
    pool
      .query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [result.record.id])
      .catch((err) => logger.warn({ err }, 'No se pudo actualizar last_used_at'));
  }

  return result;
}
