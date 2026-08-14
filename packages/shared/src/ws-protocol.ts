import { z } from 'zod';
import { logEventSchema } from './log.js';
import { logQuerySchema } from './filters.js';
import { alertSchema } from './alerts.js';
import { statsBucketSchema } from './stats.js';

// ---- Client -> Server ----

export const clientMessageSchema = z.discriminatedUnion('type', [
  // Browsers can't set headers on `new WebSocket()`, so the dashboard token
  // travels as the first frame instead of a header or query param.
  z.object({ type: z.literal('auth'), token: z.string() }),
  z.object({ type: z.literal('subscribe'), filters: logQuerySchema.default({}) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---- Server -> Client ----

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('logs'), items: z.array(logEventSchema) }),
  z.object({ type: z.literal('dropped'), count: z.number().int() }),
  z.object({ type: z.literal('alert'), alert: alertSchema }),
  z.object({ type: z.literal('stats'), buckets: z.array(statsBucketSchema) }),
  z.object({ type: z.literal('paused'), missed: z.number().int() }),
  z.object({ type: z.literal('subscribed'), filters: logQuerySchema }),
  z.object({ type: z.literal('pong') }),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
