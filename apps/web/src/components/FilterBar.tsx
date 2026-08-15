import { LOG_LEVELS, type LogLevel } from '@logs/shared';
import { LEVEL_CHIP_CLASSES } from '../lib/level-styles';

export interface FilterBarProps {
  levels: LogLevel[];
  onLevelsChange: (levels: LogLevel[]) => void;
  services: string;
  onServicesChange: (value: string) => void;
  q: string;
  onQChange: (value: string) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
}

/**
 * Same filter shape drives both view modes: in Live it debounces into a WS
 * `subscribe`, in Historical it drives GET /v1/logs. Setting a from/to date
 * flips the parent to Historical mode (see App.tsx) - filtering "yesterday"
 * on a live stream is not a coherent action. Five level chips only - an
 * empty `levels` array already means all-active, so there is no "All" chip.
 */
export function FilterBar(props: FilterBarProps) {
  function toggleLevel(level: LogLevel): void {
    if (props.levels.includes(level)) {
      props.onLevelsChange(props.levels.filter((l) => l !== level));
    } else {
      props.onLevelsChange([...props.levels, level]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-outline-variant/40 bg-surface-low px-4 py-2.5">
      <div className="flex gap-1.5">
        {LOG_LEVELS.map((level) => {
          const active = props.levels.length === 0 || props.levels.includes(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${LEVEL_CHIP_CLASSES[level]} ${
                active ? 'opacity-100' : 'opacity-30'
              }`}
            >
              {level}
            </button>
          );
        })}
      </div>

      <input
        value={props.services}
        onChange={(e) => props.onServicesChange(e.target.value)}
        placeholder="servicios (coma separados)"
        className="w-48 rounded-md border border-outline-variant/40 bg-surface-highest px-2.5 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/60"
      />

      <input
        value={props.q}
        onChange={(e) => props.onQChange(e.target.value)}
        placeholder="buscar en el mensaje..."
        className="min-w-48 flex-1 rounded-md border border-outline-variant/40 bg-surface-highest px-2.5 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/60"
      />

      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <label className="flex items-center gap-1">
          Desde
          <input
            type="datetime-local"
            value={props.from}
            onChange={(e) => props.onFromChange(e.target.value)}
            className="rounded-md border border-outline-variant/40 bg-surface-highest px-1.5 py-1 text-on-surface"
          />
        </label>
        <label className="flex items-center gap-1">
          Hasta
          <input
            type="datetime-local"
            value={props.to}
            onChange={(e) => props.onToChange(e.target.value)}
            className="rounded-md border border-outline-variant/40 bg-surface-highest px-1.5 py-1 text-on-surface"
          />
        </label>
      </div>
    </div>
  );
}
