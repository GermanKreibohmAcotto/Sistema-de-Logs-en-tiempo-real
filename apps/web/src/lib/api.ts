import type {
  Alert,
  AlertRule,
  AlertRuleInput,
  ExportFormat,
  LogEvent,
  LogLevel,
  StatsBucket,
} from '@logs/shared';
import { clearDashboardToken, getDashboardToken } from './dashboard-token';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getDashboardToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      // Only claim JSON when there's actually a body - Fastify's JSON body
      // parser 400s on an empty body declared as application/json, which is
      // exactly what a bodyless DELETE was sending before this guard.
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'x-dashboard-token': token } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    // Token missing/wrong/rotated: drop it and reload so the token gate
    // reappears instead of the app limping along with broken requests.
    clearDashboardToken();
    window.location.reload();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function buildQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface LogFilterParams {
  levels?: LogLevel[];
  services?: string[];
  q?: string;
  from?: string;
  to?: string;
}

export async function fetchLogs(
  params: LogFilterParams & { cursor?: string; limit?: number },
): Promise<{ items: LogEvent[]; nextCursor: string | null }> {
  return request(`/v1/logs${buildQueryString(params)}`);
}

export async function fetchTimeseries(
  params: LogFilterParams & { bucketSeconds?: number },
): Promise<{ buckets: StatsBucket[] }> {
  return request(`/v1/stats/timeseries${buildQueryString(params)}`);
}

export async function fetchAlertHistory(limit = 50): Promise<{ alerts: Alert[] }> {
  return request(`/v1/alerts${buildQueryString({ limit })}`);
}

export async function fetchAlertRules(): Promise<{ rules: AlertRule[] }> {
  return request('/v1/alerts/rules');
}

export async function createAlertRule(input: AlertRuleInput): Promise<{ rule: AlertRule }> {
  return request('/v1/alerts/rules', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateAlertRule(
  id: string,
  input: Partial<AlertRuleInput>,
): Promise<{ rule: AlertRule }> {
  return request(`/v1/alerts/rules/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteAlertRule(id: string): Promise<void> {
  await request(`/v1/alerts/rules/${id}`, { method: 'DELETE' });
}

/**
 * Absolute URL for the download navigation. BASE_URL is "" in production
 * (nginx serves same-origin, see apps/web/Dockerfile) and `new URL()` throws
 * on a relative string without a base - passing an absolute base here makes
 * this work the same in dev and in production. `base` is overridable for
 * testing without touching import.meta.env.
 *
 * Not fetched via `request` - this is meant to be assigned to
 * window.location so the browser handles the download/streaming response
 * itself.
 */
export function exportDownloadUrl(
  params: LogFilterParams & { format: ExportFormat },
  ticket: string,
  base = BASE_URL,
): string {
  const path = `${base}/v1/logs/export${buildQueryString({ ...params, ticket })}`;
  return new URL(path, window.location.origin).toString();
}

/** Mints a one-time export ticket over a real fetch() (header auth still works) for the navigation-only download to carry instead. */
export async function requestExportTicket(): Promise<{ ticket: string }> {
  return request('/v1/logs/export/ticket', { method: 'POST' });
}
