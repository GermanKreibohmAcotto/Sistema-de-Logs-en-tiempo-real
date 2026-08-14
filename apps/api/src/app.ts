import Fastify, { type FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import { config } from './config.js';
import { logger } from './logger.js';
import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';
import { queryRoutes } from './routes/query.js';
import { statsRoutes } from './routes/stats.js';
import { exportRoutes } from './routes/export.js';
import { alertsRoutes } from './routes/alerts.js';
import { registerWebSocketGateway } from './realtime/gateway.js';
import { startLogSubscriber } from './realtime/subscriber.js';
import { requireDashboardToken } from './plugins/dashboard-auth.js';

export async function buildApp() {
  const app = Fastify({
    // Cast: pino's Logger<never, boolean> and Fastify's FastifyBaseLogger
    // have diverged slightly across versions (a `msgPrefix` field), but the
    // pino instance satisfies FastifyBaseLogger at runtime - this keeps the
    // rest of the app's types on the default (non-pino-specific) logger
    // generic instead of it propagating everywhere.
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024, // bulk payloads of up to 1000 log lines
  });

  await app.register(cors, { origin: config.CORS_ORIGIN });
  await app.register(websocketPlugin, { options: { maxPayload: 64 * 1024 } });

  await app.register(healthRoutes);
  await app.register(ingestRoutes);
  // Ticket-gated instead of header-gated - see routes/export.ts.
  await app.register(exportRoutes);

  // Dashboard reads share one guard instead of repeating a preHandler on
  // each route: registering inside a nested plugin gives Fastify's
  // encapsulation a scope to hang the hook on without touching ingest,
  // export or health.
  await app.register(async (dashboardReads) => {
    dashboardReads.addHook('preHandler', requireDashboardToken);
    await dashboardReads.register(queryRoutes);
    await dashboardReads.register(statsRoutes);
    await dashboardReads.register(alertsRoutes);
  });

  registerWebSocketGateway(app);
  // The gateway only fans out events it receives from this subscription
  // (see realtime/subscriber.ts) - without it, buildApp() returns an app
  // whose WS clients connect fine but never receive a `logs` frame. Idempotent,
  // so safe regardless of how many times buildApp() is called (e.g. in tests).
  await startLogSubscriber();

  return app;
}
