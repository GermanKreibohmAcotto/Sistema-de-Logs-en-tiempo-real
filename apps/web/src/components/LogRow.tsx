import type { LogEvent } from '@logs/shared';
import { LEVEL_ACCENT_CLASSES, LEVEL_ROW_CLASSES, LEVEL_TEXT_CLASSES } from '../lib/level-styles';
import { COLUMN_CLASSES } from '../lib/row-metrics';

/**
 * `h-full` + `overflow-hidden` + no vertical padding keeps the rendered
 * height exactly equal to the wrapper's inline `style.height` (28px), which
 * in turn equals the virtualizer's `estimateSize()` - see `row-metrics.ts`.
 * The accent bar is absolutely positioned over the left edge instead of
 * taking flex space, so column widths stay identical to the header row
 * whether or not a given level renders one.
 */
export function LogRow({ event }: { event: LogEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString('es-AR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const accent = LEVEL_ACCENT_CLASSES[event.level];

  return (
    <div
      className={`relative flex h-full items-center gap-3 overflow-hidden border-b border-outline-variant/20 px-3 font-mono text-xs ${LEVEL_ROW_CLASSES[event.level]}`}
    >
      {accent && <span className={`absolute inset-y-0 left-0 w-0.5 ${accent}`} />}
      <span className={`${COLUMN_CLASSES.time} text-on-surface-variant/70`}>{time}</span>
      <span
        className={`${COLUMN_CLASSES.level} truncate text-center font-sans text-[10px] font-semibold ${LEVEL_TEXT_CLASSES[event.level]}`}
      >
        {event.level}
      </span>
      <span
        className={`${COLUMN_CLASSES.service} truncate font-sans text-on-surface-variant`}
        title={event.service}
      >
        {event.service}
      </span>
      <span className={`${COLUMN_CLASSES.message} truncate text-on-surface`} title={event.message}>
        {event.message}
      </span>
    </div>
  );
}
