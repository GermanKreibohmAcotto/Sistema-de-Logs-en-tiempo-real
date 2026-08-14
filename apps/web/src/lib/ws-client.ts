import { serverMessageSchema, type Alert, type ClientMessage, type LogEvent, type LogQuery, type StatsBucket } from '@logs/shared';
import { getDashboardToken } from './dashboard-token';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const AUTH_REJECTED_CLOSE_CODE = 4401;

type LogsHandler = (items: LogEvent[]) => void;
type DroppedHandler = (count: number) => void;
type AlertHandler = (alert: Alert) => void;
type StatsHandler = (buckets: StatsBucket[]) => void;
type PausedHandler = (missed: number) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type AuthErrorHandler = () => void;

const MAX_BACKOFF_MS = 30_000;

/**
 * Owns the single WS connection: reconnects with exponential backoff + jitter,
 * re-subscribes with the last known filters on reconnect, and exposes typed
 * event registration instead of a raw `onmessage`.
 */
export class WsClient {
  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private currentFilters: LogQuery = {};

  private logsHandlers = new Set<LogsHandler>();
  private droppedHandlers = new Set<DroppedHandler>();
  private alertHandlers = new Set<AlertHandler>();
  private statsHandlers = new Set<StatsHandler>();
  private pausedHandlers = new Set<PausedHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private authErrorHandlers = new Set<AuthErrorHandler>();

  constructor(private readonly url: string) {}

  connect(): void {
    this.manuallyClosed = false;
    this.open();
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  subscribe(filters: LogQuery): void {
    this.currentFilters = filters;
    this.send({ type: 'subscribe', filters });
  }

  pause(): void {
    this.send({ type: 'pause' });
  }

  resume(): void {
    this.send({ type: 'resume' });
  }

  onLogs(handler: LogsHandler): () => void {
    this.logsHandlers.add(handler);
    return () => this.logsHandlers.delete(handler);
  }

  onDropped(handler: DroppedHandler): () => void {
    this.droppedHandlers.add(handler);
    return () => this.droppedHandlers.delete(handler);
  }

  onAlert(handler: AlertHandler): () => void {
    this.alertHandlers.add(handler);
    return () => this.alertHandlers.delete(handler);
  }

  onStats(handler: StatsHandler): () => void {
    this.statsHandlers.add(handler);
    return () => this.statsHandlers.delete(handler);
  }

  onPaused(handler: PausedHandler): () => void {
    this.pausedHandlers.add(handler);
    return () => this.pausedHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onAuthError(handler: AuthErrorHandler): () => void {
    this.authErrorHandlers.add(handler);
    return () => this.authErrorHandlers.delete(handler);
  }

  private open(): void {
    this.setStatus(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
      const token = getDashboardToken();
      if (token) this.send({ type: 'auth', token });
      this.send({ type: 'subscribe', filters: this.currentFilters });
    });

    socket.addEventListener('message', (event) => {
      let parsed;
      try {
        parsed = serverMessageSchema.parse(JSON.parse(event.data as string));
      } catch {
        return;
      }
      switch (parsed.type) {
        case 'logs':
          for (const handler of this.logsHandlers) handler(parsed.items);
          break;
        case 'dropped':
          for (const handler of this.droppedHandlers) handler(parsed.count);
          break;
        case 'alert':
          for (const handler of this.alertHandlers) handler(parsed.alert);
          break;
        case 'stats':
          for (const handler of this.statsHandlers) handler(parsed.buckets);
          break;
        case 'paused':
          for (const handler of this.pausedHandlers) handler(parsed.missed);
          break;
        case 'subscribed':
        case 'pong':
          break;
      }
    });

    socket.addEventListener('close', (event) => {
      if (this.manuallyClosed) return;
      if (event.code === AUTH_REJECTED_CLOSE_CODE) {
        // Bad/missing token: reconnecting would just repeat the rejection.
        for (const handler of this.authErrorHandlers) handler();
        return;
      }
      this.setStatus('disconnected');
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt++;
    const base = Math.min(1000 * 2 ** this.reconnectAttempt, MAX_BACKOFF_MS);
    const jitter = Math.random() * base * 0.3;
    this.reconnectTimer = setTimeout(() => this.open(), base + jitter);
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    for (const handler of this.statusHandlers) handler(status);
  }
}
