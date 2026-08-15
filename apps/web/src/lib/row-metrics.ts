/**
 * 28px is load-bearing across three consumers: the virtualizer's
 * `estimateSize()`, each row wrapper's inline `style.height`, and the
 * rendered height of `LogRow` itself (which must render with no vertical
 * padding to stay exactly 28px tall). One module, one number, so the
 * invariant can never drift between `LogConsole` and `HistoricalLogList`.
 */
export const ROW_HEIGHT = 28;

/** Tailwind's default 4px scale: h-7 = 28px, matching ROW_HEIGHT exactly. */
export const ROW_HEIGHT_CLASS = 'h-7';

/** Shared column widths so the console/list body lines up with its header row. */
export const COLUMN_CLASSES = {
  time: 'w-20 shrink-0',
  level: 'w-14 shrink-0',
  service: 'w-32 shrink-0',
  message: 'min-w-0 flex-1',
} as const;
