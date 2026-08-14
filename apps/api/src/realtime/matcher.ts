import type { LogEvent, LogQuery } from '@logs/shared';

/** Evaluated per event, per connected client, before it ever reaches a WS frame. */
export function matchesFilter(event: LogEvent, filters: LogQuery): boolean {
  if (filters.levels && filters.levels.length > 0 && !filters.levels.includes(event.level)) {
    return false;
  }
  if (
    filters.services &&
    filters.services.length > 0 &&
    !filters.services.includes(event.service)
  ) {
    return false;
  }
  if (filters.q && !event.message.toLowerCase().includes(filters.q.toLowerCase())) {
    return false;
  }
  if (filters.from && event.timestamp < filters.from) return false;
  if (filters.to && event.timestamp > filters.to) return false;
  return true;
}
