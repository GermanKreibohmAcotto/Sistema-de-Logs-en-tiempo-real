import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Must run before config.js is ever imported (module-level singleton, read
// once) - static imports are hoisted in ESM, so this uses dynamic import()
// instead of a plain top-of-file `import`, same trick vitest.setup.ts relies
// on for NODE_ENV/DATABASE_URL/REDIS_URL.
process.env.DASHBOARD_TOKEN = 'test-dashboard-token-12345';
const TOKEN = process.env.DASHBOARD_TOKEN;

const { buildApp } = await import('../../src/app.js');
const { isStackReachable, ensureTestDatabase } = await import('./setup.js');

const available = await isStackReachable();

describe.skipIf(!available)('DASHBOARD_TOKEN gating (needs Postgres/Redis reachable)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    await ensureTestDatabase();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a dashboard read with no token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/logs' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a dashboard read with the wrong token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/logs',
      headers: { 'x-dashboard-token': 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a dashboard read with the correct token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/logs',
      headers: { 'x-dashboard-token': TOKEN! },
    });
    expect(res.statusCode).toBe(200);
  });

  it('guards stats, alert rules and the export ticket route the same way', async () => {
    const stats = await app.inject({ method: 'GET', url: '/v1/stats/timeseries' });
    expect(stats.statusCode).toBe(401);

    const rules = await app.inject({ method: 'GET', url: '/v1/alerts/rules' });
    expect(rules.statusCode).toBe(401);

    const ticket = await app.inject({ method: 'POST', url: '/v1/logs/export/ticket' });
    expect(ticket.statusCode).toBe(401);
  });

  it('gates export by a single-use ticket, not the header', async () => {
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/v1/logs/export/ticket',
      headers: { 'x-dashboard-token': TOKEN! },
    });
    expect(ticketRes.statusCode).toBe(200);
    const { ticket } = ticketRes.json() as { ticket: string };

    const noTicket = await app.inject({ method: 'GET', url: '/v1/logs/export' });
    expect(noTicket.statusCode).toBe(401);

    const withTicket = await app.inject({ method: 'GET', url: `/v1/logs/export?ticket=${ticket}` });
    expect(withTicket.statusCode).toBe(200);

    const reused = await app.inject({ method: 'GET', url: `/v1/logs/export?ticket=${ticket}` });
    expect(reused.statusCode).toBe(401);
  });

  it('closes the WS handshake with 4401 on a missing/invalid auth frame', async () => {
    const ws = await app.injectWS('/ws');
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code: number) => resolve(code));
      ws.send(JSON.stringify({ type: 'auth', token: 'wrong' }));
    });
    expect(closeCode).toBe(4401);
  });

  it('accepts the WS handshake once a valid auth frame arrives', async () => {
    const ws = await app.injectWS('/ws');
    const subscribed = await new Promise<boolean>((resolve) => {
      ws.on('message', (raw: Buffer) => {
        const msg = JSON.parse(raw.toString()) as { type: string };
        if (msg.type === 'subscribed') resolve(true);
      });
      ws.send(JSON.stringify({ type: 'auth', token: TOKEN }));
      ws.send(JSON.stringify({ type: 'subscribe', filters: {} }));
    });
    expect(subscribed).toBe(true);
    ws.close();
  });
});
