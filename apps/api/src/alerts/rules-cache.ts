import type { AlertRule } from '@logs/shared';
import { pool } from '../db/pool.js';
import { logger } from '../logger.js';

interface RuleRow {
  id: number;
  name: string;
  levels: string[];
  service: string | null;
  threshold: number;
  window_seconds: number;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export function rowToRule(row: RuleRow): AlertRule {
  return {
    id: String(row.id),
    name: row.name,
    levels: row.levels as AlertRule['levels'],
    service: row.service,
    threshold: row.threshold,
    windowSeconds: row.window_seconds,
    cooldownSeconds: row.cooldown_seconds,
    enabled: row.enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * In-memory cache of enabled rules, refreshed every 10s (and immediately
 * after any CRUD write in routes/alerts.ts). The ingest hot path checks a
 * rule on every accepted batch, so it reads this cache instead of hitting
 * Postgres per event - a new/edited rule takes effect within one refresh
 * cycle rather than instantly, which is an acceptable trade for not adding
 * a DB round-trip to every ingest request.
 */
let cache: AlertRule[] = [];

export function getEnabledRules(): AlertRule[] {
  return cache;
}

export async function refreshRulesCache(): Promise<void> {
  try {
    const { rows } = await pool.query<RuleRow>(
      // levels::text[] - node-postgres only auto-parses array OIDs it
      // recognizes as built-ins; a custom enum array (log_level[]) comes
      // back as the raw "{ERROR}" literal string otherwise, not a JS array.
      `SELECT id, name, levels::text[] AS levels, service, threshold, window_seconds,
              cooldown_seconds, enabled, created_at, updated_at
       FROM alert_rules WHERE enabled = true`,
    );
    cache = rows.map(rowToRule);
  } catch (err) {
    logger.warn({ err }, 'No se pudo refrescar la cache de reglas de alertas');
  }
}

const REFRESH_INTERVAL_MS = 10_000;

export function startRulesCacheRefresh(): () => void {
  void refreshRulesCache();
  const handle = setInterval(() => void refreshRulesCache(), REFRESH_INTERVAL_MS);
  handle.unref();
  return () => clearInterval(handle);
}
