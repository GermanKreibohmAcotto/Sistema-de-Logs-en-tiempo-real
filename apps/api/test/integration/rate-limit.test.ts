import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redisCmd } from '../../src/redis.js';
import { createApiKey } from '../../src/ingest/api-keys.js';
import { isStackReachable, ensureTestDatabase } from './setup.js';

const available = await isStackReachable();

describe.skipIf(!available)('rate limiting (needs Postgres/Redis reachable)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let apiKey: string;
  let apiKeyId: number;
  const service = `test-ratelimit-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    await ensureTestDatabase();
    const created = await createApiKey(`test-key-${randomUUID().slice(0, 8)}`, 5); // 5 logs/min
    apiKey = created.rawKey;
    apiKeyId = created.record.id;
    await redisCmd.del(`ratelimit:${apiKeyId}`);
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM logs WHERE service = $1', [service]);
    await pool.query('DELETE FROM api_keys WHERE id = $1', [apiKeyId]);
    await app.close();
    await pool.end();
  });

  it('returns 429 once the bucket is exhausted - a bulk request costs N tokens, not 1', async () => {
    const withinLimit = await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': apiKey },
      payload: Array.from({ length: 5 }, (_, i) => ({ level: 'INFO', service, message: `log-${i}` })),
    });
    expect(withinLimit.statusCode).toBe(202);

    const overLimit = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { 'x-api-key': apiKey },
      payload: { level: 'INFO', service, message: 'one too many' },
    });
    expect(overLimit.statusCode).toBe(429);
    expect(overLimit.headers['retry-after']).toBeDefined();
  });

  it('rejects an unknown API key with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { 'x-api-key': 'lk_does_not_exist_anywhere' },
      payload: { level: 'INFO', service, message: 'x' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a revoked API key with 403', async () => {
    const revoked = await createApiKey(`test-revoked-${randomUUID().slice(0, 8)}`, 100);
    await pool.query('UPDATE api_keys SET revoked_at = now() WHERE id = $1', [revoked.record.id]);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { 'x-api-key': revoked.rawKey },
      payload: { level: 'INFO', service, message: 'x' },
    });
    expect(res.statusCode).toBe(403);

    await pool.query('DELETE FROM api_keys WHERE id = $1', [revoked.record.id]);
  });
});
