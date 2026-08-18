import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { redisCmd } from '../../src/redis.js';
import { createApiKey } from '../../src/ingest/api-keys.js';
import { isStackReachable, ensureTestDatabase } from './setup.js';

const available = await isStackReachable();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe.skipIf(!available)('alert engine (needs Postgres/Redis reachable)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let apiKey: string;
  let ruleId: string;
  const service = `test-alerts-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    await ensureTestDatabase();
    const created = await createApiKey(`test-key-${randomUUID().slice(0, 8)}`, 100_000);
    apiKey = created.rawKey;

    app = await buildApp();
    await app.ready();

    const ruleRes = await app.inject({
      method: 'POST',
      url: '/v1/alerts/rules',
      payload: {
        name: `test-rule-${service}`,
        levels: ['ERROR'],
        service,
        threshold: 3,
        windowSeconds: 60,
        cooldownSeconds: 60,
        enabled: true,
      },
    });
    expect(ruleRes.statusCode).toBe(201);
    ruleId = (ruleRes.json() as { rule: { id: string } }).rule.id;
    // POST /v1/alerts/rules already refreshes the in-memory cache the
    // ingest path reads from - no extra wait needed here.
  });

  afterAll(async () => {
    await pool.query('DELETE FROM logs WHERE service = $1', [service]);
    await pool.query('DELETE FROM alerts WHERE rule_id = $1', [Number(ruleId)]);
    await pool.query('DELETE FROM alert_rules WHERE id = $1', [Number(ruleId)]);
    await redisCmd.del(`alert:window:${ruleId}`, `alert:cooldown:${ruleId}`);
    await app.close();
    await pool.end();
  });

  it('fires an alert once the threshold is exceeded within the window', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': apiKey },
      payload: Array.from({ length: 3 }, (_, i) => ({
        level: 'ERROR',
        service,
        message: `boom-${i}`,
      })),
    });
    expect(res.statusCode).toBe(202);

    // evaluateIngestedBatch runs fire-and-forget from the ingest route -
    // give it a moment to hit Redis/Postgres and persist the alert.
    await sleep(300);

    const historyRes = await app.inject({ method: 'GET', url: '/v1/alerts?limit=20' });
    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json() as { alerts: { ruleId: string; count: number }[] };
    const fired = history.alerts.find((a) => a.ruleId === ruleId);
    expect(fired).toBeDefined();
    expect(fired?.count).toBeGreaterThanOrEqual(3);
  });

  it('does not fire again immediately - the cooldown suppresses repeats', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs/bulk',
      headers: { 'x-api-key': apiKey },
      payload: Array.from({ length: 3 }, (_, i) => ({
        level: 'ERROR',
        service,
        message: `boom-again-${i}`,
      })),
    });
    expect(res.statusCode).toBe(202);
    await sleep(300);

    const historyRes = await app.inject({ method: 'GET', url: '/v1/alerts?limit=20' });
    const history = historyRes.json() as { alerts: { ruleId: string }[] };
    const firedCount = history.alerts.filter((a) => a.ruleId === ruleId).length;
    // Only the first test's trigger should be recorded - cooldownSeconds=60
    // blocks a second alert row for the same rule this soon after.
    expect(firedCount).toBe(1);
  });
});
