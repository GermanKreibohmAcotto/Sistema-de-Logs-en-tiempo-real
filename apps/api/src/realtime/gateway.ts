import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import {
  clientMessageSchema,
  logQuerySchema,
  type Alert,
  type LogEvent,
  type LogQuery,
  type ServerMessage,
  type StatsBucket,
} from '@logs/shared';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { matchesFilter } from './matcher.js';
import { onLogBatch } from './subscriber.js';
import { isDashboardTokenValid } from '../plugins/dashboard-auth.js';

const AUTH_TIMEOUT_MS = 5000;

interface ClientState {
  id: string;
  socket: WebSocket;
  filters: LogQuery;
  paused: boolean;
  missedWhilePaused: number;
  queue: LogEvent[];
  droppedSinceLastFrame: number;
  isAlive: boolean;
}

const clients = new Map<string, ClientState>();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(message));
}

function enqueue(client: ClientState, event: LogEvent): void {
  if (client.paused) {
    client.missedWhilePaused++;
    return;
  }
  if (!matchesFilter(event, client.filters)) return;

  client.queue.push(event);
  if (client.queue.length > config.WS_CLIENT_QUEUE_MAX) {
    // Drop the oldest, not the newest: a slow client degrades its own view
    // (stale-but-bounded backlog) instead of growing server memory.
    client.queue.shift();
    client.droppedSinceLastFrame++;
  }
}

/** Fans out a decoded batch from Redis to every connected, matching client. */
function distribute(events: LogEvent[]): void {
  for (const client of clients.values()) {
    for (const event of events) enqueue(client, event);
  }
}

/**
 * One global timer instead of one per socket: turns e.g. 500 events/s * N
 * clients into N frames every WS_BATCH_MS, and gives a single choke point to
 * check `bufferedAmount` right before each write.
 */
function startBatchLoop(): () => void {
  const handle = setInterval(() => {
    for (const client of clients.values()) {
      if (client.socket.bufferedAmount > config.WS_MAX_BUFFERED_BYTES) {
        // Already-queued bytes haven't drained - the client can't keep up.
        // Drop this tick's batch instead of growing the socket's own buffer
        // further, which is how a single slow tab would balloon server RSS.
        client.droppedSinceLastFrame += client.queue.length;
        client.queue = [];
        continue;
      }
      if (client.queue.length > 0) {
        send(client.socket, { type: 'logs', items: client.queue });
        client.queue = [];
      }
      if (client.droppedSinceLastFrame > 0) {
        send(client.socket, { type: 'dropped', count: client.droppedSinceLastFrame });
        client.droppedSinceLastFrame = 0;
      }
    }
  }, config.WS_BATCH_MS);
  handle.unref();
  return () => clearInterval(handle);
}

/** Terminates sockets that stopped answering pings - avoids leaking dead connections after a network cut. */
function startHeartbeat(): () => void {
  const handle = setInterval(() => {
    for (const [id, client] of clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        clients.delete(id);
        continue;
      }
      client.isAlive = false;
      client.socket.ping();
    }
  }, config.WS_HEARTBEAT_MS);
  handle.unref();
  return () => clearInterval(handle);
}

/** Broadcast hooks other subsystems (alert engine, stats job) push into. */
export function broadcastAlert(alert: Alert): void {
  for (const client of clients.values()) send(client.socket, { type: 'alert', alert });
}

export function pushStatsBuckets(buckets: StatsBucket[]): void {
  for (const client of clients.values()) send(client.socket, { type: 'stats', buckets });
}

export function connectedClientCount(): number {
  return clients.size;
}

export function registerWebSocketGateway(app: FastifyInstance): void {
  const stopBatchLoop = startBatchLoop();
  const stopHeartbeat = startHeartbeat();
  const stopSubscriber = onLogBatch(distribute);

  app.addHook('onClose', () => {
    stopBatchLoop();
    stopHeartbeat();
    stopSubscriber();
  });

  app.get('/ws', { websocket: true }, (socket) => {
    const id = randomUUID();
    const client: ClientState = {
      id,
      socket,
      filters: {},
      paused: false,
      missedWhilePaused: 0,
      queue: [],
      droppedSinceLastFrame: 0,
      isAlive: true,
    };
    // DASHBOARD_TOKEN unset => open/dev mode, activate immediately as before.
    // Otherwise the socket stays out of `clients` (no fan-out, no batching)
    // until a valid `auth` frame arrives.
    let authenticated = !config.DASHBOARD_TOKEN;
    let authTimer: ReturnType<typeof setTimeout> | null = null;

    function activate(): void {
      clients.set(id, client);
      logger.info({ clientId: id, total: clients.size }, 'Cliente WS conectado');
    }

    if (authenticated) {
      activate();
    } else {
      authTimer = setTimeout(() => socket.close(4401, 'auth_timeout'), AUTH_TIMEOUT_MS);
    }

    socket.on('pong', () => {
      client.isAlive = true;
    });

    socket.on('message', (raw: WebSocket.RawData) => {
      let parsed;
      try {
        parsed = clientMessageSchema.parse(JSON.parse(raw.toString()));
      } catch {
        return; // frame malformado: se ignora, no se tumba la conexion
      }

      if (!authenticated) {
        if (parsed.type === 'auth') {
          if (isDashboardTokenValid(parsed.token)) {
            authenticated = true;
            if (authTimer) clearTimeout(authTimer);
            activate();
          } else {
            socket.close(4401, 'invalid_token');
          }
        }
        return; // cualquier otro frame antes de autenticar se ignora
      }

      switch (parsed.type) {
        case 'auth': {
          break; // ya autenticado, frame redundante
        }
        case 'subscribe': {
          client.filters = logQuerySchema.parse(parsed.filters ?? {});
          send(socket, { type: 'subscribed', filters: client.filters });
          break;
        }
        case 'pause': {
          client.paused = true;
          break;
        }
        case 'resume': {
          const missed = client.missedWhilePaused;
          client.paused = false;
          client.missedWhilePaused = 0;
          send(socket, { type: 'paused', missed });
          break;
        }
        case 'ping': {
          send(socket, { type: 'pong' });
          break;
        }
      }
    });

    socket.on('close', () => {
      if (authTimer) clearTimeout(authTimer);
      clients.delete(id);
      logger.info({ clientId: id, total: clients.size }, 'Cliente WS desconectado');
    });

    socket.on('error', (err: Error) => {
      logger.warn({ err, clientId: id }, 'Error en socket WS');
    });
  });
}
