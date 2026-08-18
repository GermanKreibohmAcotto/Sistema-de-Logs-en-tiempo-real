export type ViewMode = 'live' | 'historical';

export interface TimeRange {
  from: string;
  to: string;
}

/**
 * The settled "En vivo clears the range" rule, extracted so it is
 * machine-checkable independent of App's DOM/state wiring. Reproduces
 * today's `handleBackToLive` exactly: switching to live always clears
 * from/to. Switching to historical never invents a range - it only keeps
 * whatever the operator already had.
 */
export function applyModeChange(
  next: ViewMode,
  range: TimeRange,
): { mode: ViewMode; range: TimeRange } {
  return next === 'live'
    ? { mode: 'live', range: { from: '', to: '' } }
    : { mode: 'historical', range };
}
