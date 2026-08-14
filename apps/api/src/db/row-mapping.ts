import type { LogEvent, LogLevel } from '@logs/shared';

export interface LogRow {
  id: string | number;
  ts: Date;
  level: string;
  service: string;
  message: string;
  metadata: unknown;
  trace_id: string | null;
  ingested_at: Date;
}

/** DB row -> wire format. `id` here is `${ts}:${dbId}`, distinct from the
 * client-generated UUID a live-streamed LogEvent carries (see routes/ingest.ts) -
 * Live and Historical are separate view modes that are never merged, so the
 * two id schemes never need to compare equal. */
export function rowToLogEvent(row: LogRow): LogEvent {
  return {
    id: `${row.ts.toISOString()}:${row.id}`,
    timestamp: row.ts.toISOString(),
    level: row.level as LogLevel,
    service: row.service,
    message: row.message,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    traceId: row.trace_id ?? null,
    ingestedAt: row.ingested_at.toISOString(),
  };
}
