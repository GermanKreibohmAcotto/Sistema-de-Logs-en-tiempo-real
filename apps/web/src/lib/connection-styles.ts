import type { ConnectionStatus } from './ws-client';

/**
 * Shared between `ConnectionBanner` (header pill) and `Sidebar` (endpoint
 * card dot) so both surfaces stay in lockstep with the real `WsClient`
 * status instead of each owning a private copy. Discreet by design: no
 * degraded state gets a pulse or a loud colour, per the "Discreet Degraded
 * States" requirement - `disconnected` is a plain dot + small text, never a
 * banner.
 */
export const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Conectando...',
  connected: 'Conectado',
  reconnecting: 'Reconectando...',
  disconnected: 'Desconectado',
};

export const STATUS_DOT_CLASSES: Record<ConnectionStatus, string> = {
  connecting: 'bg-tertiary',
  connected: 'bg-secondary',
  reconnecting: 'bg-tertiary',
  disconnected: 'bg-error',
};
