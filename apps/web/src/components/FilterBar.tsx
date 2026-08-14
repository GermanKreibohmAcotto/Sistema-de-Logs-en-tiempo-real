import { LOG_LEVELS, type LogLevel } from '@logs/shared';
import { LEVEL_BADGE_CLASSES } from '../lib/level-styles';

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
  mode: 'live' | 'historical';
  onBackToLive: () => void;
}

/**
 * Same filter shape drives both view modes: in Live it debounces into a WS
 * `subscribe`, in Historical it drives GET /v1/logs. Setting a from/to date
 * flips the parent to Historical mode (see App.tsx) - filtering "yesterday"
 * on a live stream is not a coherent action.
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
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
      <div className="flex gap-1.5">
        {LOG_LEVELS.map((level) => {
          const active = props.levels.length === 0 || props.levels.includes(level);
          return (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              className={`rounded px-2 py-1 text-[10px] font-semibold transition-opacity ${LEVEL_BADGE_CLASSES[level]} ${
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
        className="w-48 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600"
      />

      <input
        value={props.q}
        onChange={(e) => props.onQChange(e.target.value)}
        placeholder="buscar en el mensaje..."
        className="min-w-48 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600"
      />

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <label>
          Desde{' '}
          <input
            type="datetime-local"
            value={props.from}
            onChange={(e) => props.onFromChange(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-100"
          />
        </label>
        <label>
          Hasta{' '}
          <input
            type="datetime-local"
            value={props.to}
            onChange={(e) => props.onToChange(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-100"
          />
        </label>
      </div>

      <span
        className={`rounded px-2 py-1 text-[10px] font-semibold ${
          props.mode === 'live' ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-700 text-slate-200'
        }`}
      >
        {props.mode === 'live' ? 'EN VIVO' : 'HISTORICO'}
      </span>
      {props.mode === 'historical' && (
        <button
          onClick={props.onBackToLive}
          className="rounded bg-emerald-800 px-2 py-1 text-xs font-semibold text-emerald-50 hover:bg-emerald-700"
        >
          Volver a en vivo
        </button>
      )}
    </div>
  );
}
