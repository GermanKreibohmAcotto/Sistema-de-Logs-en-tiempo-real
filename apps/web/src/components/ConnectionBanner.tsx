import type { ConnectionStatus } from '../lib/ws-client';
import { STATUS_DOT_CLASSES, STATUS_LABELS } from '../lib/connection-styles';

/**
 * Header pill only - never a full-width banner. Discreet by design: even
 * `disconnected` stays small text + a dot, no pulse, so a real incident
 * doesn't compete visually with the log stream (accepted tradeoff: a
 * discreet disconnect state may be missed mid-incident).
 */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
      {STATUS_LABELS[status]}
    </div>
  );
}
