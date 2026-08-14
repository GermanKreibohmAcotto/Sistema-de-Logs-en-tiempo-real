import type { Alert, AlertRule, AlertRuleInput, LogEvent, LogLevel, StatsBucket } from '@logs/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
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

/** Not fetched via `request` - this is meant to be assigned to an <a href>/window.location so the browser handles the download/streaming response itself. */
export function exportUrl(params: LogFilterParams & { format: 'csv' | 'json' | 'ndjson' }): string {
  return `${BASE_URL}/v1/logs/export${buildQueryString(params)}`;
}
