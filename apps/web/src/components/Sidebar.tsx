import type { ConnectionStatus } from '../lib/ws-client';
import type { ViewMode } from '../lib/view-mode';
import { STATUS_DOT_CLASSES } from '../lib/connection-styles';
import { IconHistory, IconLive, type IconProps } from './icons';

export interface SidebarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Dot colour only - the header pill (`ConnectionBanner`) owns the label. */
  status: ConnectionStatus;
  /** `WS_URL` host, rendered in the monospace endpoint card. */
  endpoint: string;
}

const MODE_BUTTONS: ReadonlyArray<{
  mode: ViewMode;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
}> = [
  { mode: 'live', label: 'En vivo', Icon: IconLive },
  { mode: 'historical', label: 'Histórico', Icon: IconHistory },
];

/**
 * Pure presentational shell: no hooks, no fetching. All state lives in
 * `App`; this component only renders it and reports intent via
 * `onModeChange`.
 */
export function Sidebar({ mode, onModeChange, status, endpoint }: SidebarProps) {
  return (
    <nav className="flex w-72 shrink-0 flex-col gap-6 border-r border-outline-variant/40 bg-surface-lowest px-4 py-5">
      <h1 className="px-2 text-sm font-semibold text-on-surface">Monitoreo de Logs</h1>

      <div className="flex flex-col gap-1">
        {MODE_BUTTONS.map(({ mode: buttonMode, label, Icon }) => {
          const active = mode === buttonMode;
          return (
            <button
              key={buttonMode}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(buttonMode)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-container/20 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-on-surface-variant">{endpoint}</span>
      </div>
    </nav>
  );
}
