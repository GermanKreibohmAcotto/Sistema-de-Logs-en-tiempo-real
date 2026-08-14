import { randomUUID } from 'node:crypto';
import type { Alert, AlertRule, LogEvent } from '@logs/shared';
import { redisCmd } from '../redis.js';
import { pool } from '../db/pool.js';
import { logger } from '../logger.js';
import { getEnabledRules } from './rules-cache.js';
import { broadcastAlert } from '../realtime/gateway.js';

/**
 * Sliding window counter as a Redis sorted set, scored by arrival time.
 * A fixed window with plain INCR has the classic boundary problem: 20
 * errors split evenly across a minute boundary never trip a "10 in 1
 * minute" rule. ZREMRANGEBYSCORE + ZADD + ZCARD in one atomic script keeps
 * the count correct and cheap.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

redis.call('ZREMRANGEBYSCORE', key, '-inf', now_ms - window_ms)
for i = 3, #ARGV do
  redis.call('ZADD', key, now_ms, ARGV[i])
end
redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 5)
return redis.call('ZCARD', key)
`;

function matchesRule(event: LogEvent, rule: AlertRule): boolean {
  if (!rule.levels.includes(event.level)) return false;
  if (rule.service && rule.service !== event.service) return false;
  return true;
}

/** Called by the ingest routes for every accepted batch. */
export function evaluateIngestedBatch(events: LogEvent[]): void {
  if (events.length === 0) return;
  for (const rule of getEnabledRules()) {
    const matchCount = events.reduce((n, e) => n + (matchesRule(e, rule) ? 1 : 0), 0);
    if (matchCount === 0) continue;
    void evaluateRule(rule, matchCount);
  }
}

async function evaluateRule(rule: AlertRule, matchCount: number): Promise<void> {
  try {
    const windowKey = `alert:window:${rule.id}`;
    const cooldownKey = `alert:cooldown:${rule.id}`;
    const nowMs = Date.now();
    const windowMs = rule.windowSeconds * 1000;
    // Unique members so identical-content log lines never collapse into a
    // single sorted-set entry (ZADD on an existing member just re-scores it).
    const members = Array.from({ length: matchCount }, () => randomUUID());

    const count = (await redisCmd.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      windowKey,
      nowMs,
      windowMs,
      ...members,
    )) as number;

    if (count < rule.threshold) return;

    const onCooldown = await redisCmd.exists(cooldownKey);
    if (onCooldown) return;
    await redisCmd.set(cooldownKey, '1', 'EX', rule.cooldownSeconds);

    const { rows } = await pool.query<{ id: number; triggered_at: Date }>(
      `INSERT INTO alerts (rule_id, rule_name, count, threshold, window_seconds)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, triggered_at`,
      [Number(rule.id), rule.name, count, rule.threshold, rule.windowSeconds],
    );
    const row = rows[0];
    if (!row) return;

    const alert: Alert = {
      id: String(row.id),
      ruleId: rule.id,
      ruleName: rule.name,
      count,
      threshold: rule.threshold,
      windowSeconds: rule.windowSeconds,
      triggeredAt: row.triggered_at.toISOString(),
    };
    logger.info({ alert }, 'Alerta disparada');
    broadcastAlert(alert);
  } catch (err) {
    logger.error({ err, ruleId: rule.id }, 'Fallo al evaluar la regla de alerta');
  }
}
