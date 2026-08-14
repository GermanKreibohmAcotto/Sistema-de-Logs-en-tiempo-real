import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { writeBuffer } from '../../src/ingest/write-buffer.js';
import { pool } from '../../src/db/pool.js';
import { createApiKey } from '../../src/ingest/api-keys.js';
import { isStackReachable, ensureTestDatabase } from './setup.js';

const available = await isStackReachable();

describe.skipIf(!available)('ingest -> query (needs Postgres/Redis reachable)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let apiKey: string;
  const service = `test-ingest-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    await ensureTestDatabase();
    const created = await createApiKey(`test-key-${randomUUID().slice(0, 8)}`, 100_000);
    apiKey = created.rawKey;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM logs WHERE service = $1', [service]);
    await app.close();
  });

  it('persists an accepted log and returns it via GET /v1/logs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { 'x-api-key': apiKey },
      payload: { level: 'INFO', service, message: 'hello from integration test' },
    });
    expect(res.statusCode).toBe(202);

    // Force the buffered insert out instead of waiting on WRITE_FLUSH_MS.
    await writeBuffer.flush();

    const queryRes = await app.inject({ method: 'GET', url: `/v1/logs?services=${service}` });
    expect(queryRes.statusCode).toBe(200);
    const body = queryRes.json() as { items: { message: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.message).toBe('hello from integration test');
  });

  it('rejects an ingest request with no API key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      payload: { level: 'INFO', service, message: 'no key' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { 'x-api-key': apiKey },
      payload: { level: 'NOT_A_LEVEL', service, message: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts partial bulk batches, rejecting only the malformed items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': apiKey },
      payload: [
        { level: 'INFO', service, message: 'ok-1' },
        { level: 'NOT_A_LEVEL', service, message: 'bad' },
        { level: 'WARN', service, message: 'ok-2' },
      ],
    });
    expect(res.statusCode).toBe(202);
    const body = res.json() as { accepted: number; rejected: { index: number }[] };
    expect(body.accepted).toBe(2);
    expect(body.rejected).toHaveLength(1);
    expect(body.rejected[0]?.index).toBe(1);
  });
});
