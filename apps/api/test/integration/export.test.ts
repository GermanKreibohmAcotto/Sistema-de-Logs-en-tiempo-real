import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { writeBuffer } from '../../src/ingest/write-buffer.js';
import { pool } from '../../src/db/pool.js';
import { createApiKey } from '../../src/ingest/api-keys.js';
import { isStackReachable, ensureTestDatabase } from './setup.js';

const available = await isStackReachable();

describe.skipIf(!available)('log export (needs Postgres/Redis reachable)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const service = `test-export-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    await ensureTestDatabase();
    const created = await createApiKey(`test-key-${randomUUID().slice(0, 8)}`, 100_000);

    app = await buildApp();
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': created.rawKey },
      payload: [
        { level: 'INFO', service, message: 'export me' },
        { level: 'ERROR', service, message: 'contains, a comma and "quotes"' },
      ],
    });
    await writeBuffer.flush();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM logs WHERE service = $1', [service]);
    await app.close();
    await pool.end();
  });

  it('exports a valid CSV with a header row and correctly RFC4180-escaped fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/logs/export?services=${service}&format=csv`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const lines = res.payload.trim().split('\n');
    expect(lines[0]).toBe('timestamp,level,service,message,traceId,metadata');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines.some((l) => l.includes('"contains, a comma and ""quotes"""'))).toBe(true);
  });

  it('exports valid NDJSON, one parseable log event per line', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/logs/export?services=${service}&format=ndjson`,
    });
    expect(res.statusCode).toBe(200);
    const lines = res.payload.trim().split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('exports a valid JSON array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/logs/export?services=${service}&format=json`,
    });
    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.payload) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});
