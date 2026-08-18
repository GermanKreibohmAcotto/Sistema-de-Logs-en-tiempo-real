import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ServerMessage } from '@logs/shared';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { createApiKey } from '../../src/ingest/api-keys.js';
import { isStackReachable, ensureTestDatabase } from './setup.js';

const available = await isStackReachable();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!available)('WS gateway live filtering (needs Postgres/Redis reachable)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let apiKey: string;
  const service = `test-ws-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    await ensureTestDatabase();
    const created = await createApiKey(`test-key-${randomUUID().slice(0, 8)}`, 100_000);
    apiKey = created.rawKey;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM logs WHERE service LIKE $1', [`${service}%`]);
    await app.close();
    await pool.end();
  });

  it('only delivers events matching the subscribed filter (level and service)', async () => {
    // @fastify/websocket exposes injectWS() to open a WS connection without
    // a real network listener - see node_modules/@fastify/websocket/types.
    const ws = await app.injectWS('/ws');
    const received: ServerMessage[] = [];
    ws.on('message', (raw: Buffer) => received.push(JSON.parse(raw.toString()) as ServerMessage));

    ws.send(
      JSON.stringify({ type: 'subscribe', filters: { levels: ['ERROR'], services: [service] } }),
    );
    await sleep(50); // let the `subscribed` ack land

    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': apiKey },
      payload: [
        { level: 'INFO', service, message: 'filtered out: wrong level' },
        { level: 'ERROR', service, message: 'should arrive' },
        { level: 'ERROR', service: `${service}-other`, message: 'filtered out: wrong service' },
      ],
    });
    expect(res.statusCode).toBe(202);

    // The gateway batches frames every WS_BATCH_MS (default 100ms).
    await sleep(300);

    const logsFrames = received.filter(
      (m): m is Extract<ServerMessage, { type: 'logs' }> => m.type === 'logs',
    );
    const items = logsFrames.flatMap((f) => f.items);
    expect(items).toHaveLength(1);
    expect(items[0]?.message).toBe('should arrive');

    ws.close();
  });

  it('stops delivering events while paused and reports how many were missed on resume', async () => {
    const ws = await app.injectWS('/ws');
    const received: ServerMessage[] = [];
    ws.on('message', (raw: Buffer) => received.push(JSON.parse(raw.toString()) as ServerMessage));

    ws.send(JSON.stringify({ type: 'subscribe', filters: { services: [service] } }));
    await sleep(50);
    ws.send(JSON.stringify({ type: 'pause' }));
    await sleep(50);

    await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': apiKey },
      payload: [
        { level: 'INFO', service, message: 'missed-1' },
        { level: 'INFO', service, message: 'missed-2' },
      ],
    });
    await sleep(200);

    const logsWhilePaused = received.filter((m) => m.type === 'logs');
    expect(logsWhilePaused).toHaveLength(0);

    ws.send(JSON.stringify({ type: 'resume' }));
    await sleep(100);

    const pausedAck = received.find(
      (m): m is Extract<ServerMessage, { type: 'paused' }> => m.type === 'paused',
    );
    expect(pausedAck?.missed).toBe(2);

    ws.close();
  });
});
