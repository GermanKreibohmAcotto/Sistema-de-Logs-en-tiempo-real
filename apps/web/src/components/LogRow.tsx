import type { LogEvent } from '@logs/shared';
import { LEVEL_BADGE_CLASSES } from '../lib/level-styles';

export function LogRow({ event }: { event: LogEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString('es-AR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex h-full items-center gap-3 border-b border-slate-800/60 px-3 font-mono text-xs">
      <span className="w-20 shrink-0 text-slate-500">{time}</span>
      <span
        className={`w-14 shrink-0 rounded px-1.5 py-0.5 text-center font-sans text-[10px] font-semibold ${LEVEL_BADGE_CLASSES[event.level]}`}
      >
        {event.level}
      </span>
      <span className="w-32 shrink-0 truncate font-sans text-slate-400" title={event.service}>
        {event.service}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-100" title={event.message}>
        {event.message}
      </span>
    </div>
  );
}
