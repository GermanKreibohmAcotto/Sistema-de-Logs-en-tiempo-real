import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { alertRuleInputSchema, type Alert } from '@logs/shared';
import { pool } from '../db/pool.js';
import { rowToRule, refreshRulesCache } from '../alerts/rules-cache.js';

// levels::text[] - node-postgres does not auto-parse a custom enum array
// (log_level[]) into a JS array; it only recognizes built-in array OIDs.
const RULE_COLUMNS = `id, name, levels::text[] AS levels, service, threshold, window_seconds, cooldown_seconds, enabled, created_at, updated_at`;

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const listAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const FIELD_TO_COLUMN: Record<string, string> = {
  name: 'name',
  levels: 'levels',
  service: 'service',
  threshold: 'threshold',
  windowSeconds: 'window_seconds',
  cooldownSeconds: 'cooldown_seconds',
  enabled: 'enabled',
};

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/v1/alerts/rules', async () => {
    const { rows } = await pool.query(
      `SELECT ${RULE_COLUMNS} FROM alert_rules ORDER BY created_at DESC`,
    );
    return { rules: rows.map(rowToRule) };
  });

  fastify.post('/v1/alerts/rules', async (request, reply) => {
    const parsed = alertRuleInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const input = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO alert_rules (name, levels, service, threshold, window_seconds, cooldown_seconds, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${RULE_COLUMNS}`,
      [
        input.name,
        input.levels,
        input.service ?? null,
        input.threshold,
        input.windowSeconds,
        input.cooldownSeconds,
        input.enabled,
      ],
    );
    const row = rows[0];
    if (!row) return reply.code(500).send({ error: 'insert_failed' });
    await refreshRulesCache();
    return reply.code(201).send({ rule: rowToRule(row) });
  });

  fastify.patch('/v1/alerts/rules/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.code(400).send({ error: 'invalid_id' });

    const bodyParsed = alertRuleInputSchema.partial().safeParse(request.body);
    if (!bodyParsed.success) {
      return reply
        .code(400)
        .send({ error: 'invalid_payload', details: bodyParsed.error.flatten() });
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(bodyParsed.data)) {
      const column = FIELD_TO_COLUMN[key];
      if (!column) continue;
      setClauses.push(`${column} = $${idx}`);
      params.push(value);
      idx++;
    }
    if (setClauses.length === 0) return reply.code(400).send({ error: 'no_fields' });
    setClauses.push('updated_at = now()');
    params.push(paramsParsed.data.id);

    const { rows } = await pool.query(
      `UPDATE alert_rules SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING ${RULE_COLUMNS}`,
      params,
    );
    const row = rows[0];
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await refreshRulesCache();
    return { rule: rowToRule(row) };
  });

  fastify.delete('/v1/alerts/rules/:id', async (request, reply) => {
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.code(400).send({ error: 'invalid_id' });
    await pool.query('DELETE FROM alert_rules WHERE id = $1', [paramsParsed.data.id]);
    await refreshRulesCache();
    return reply.code(204).send();
  });

  fastify.get('/v1/alerts', async (request, reply) => {
    const parsed = listAlertsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });

    const { rows } = await pool.query<{
      id: number;
      rule_id: number;
      rule_name: string;
      count: number;
      threshold: number;
      window_seconds: number;
      triggered_at: Date;
    }>(
      `SELECT id, rule_id, rule_name, count, threshold, window_seconds, triggered_at
       FROM alerts ORDER BY triggered_at DESC LIMIT $1`,
      [parsed.data.limit],
    );

    const alerts: Alert[] = rows.map((r) => ({
      id: String(r.id),
      ruleId: String(r.rule_id),
      ruleName: r.rule_name,
      count: r.count,
      threshold: r.threshold,
      windowSeconds: r.window_seconds,
      triggeredAt: r.triggered_at.toISOString(),
    }));
    return { alerts };
  });
};
