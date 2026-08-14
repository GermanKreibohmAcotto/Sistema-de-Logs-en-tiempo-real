import { z } from 'zod';

/**
 * All process.env access happens here and nowhere else. If a required
 * variable is missing or malformed, the process fails fast at startup
 * instead of surfacing a confusing error later at request time.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  INGEST_SYNC: z.coerce.boolean().default(false),
  MAX_BUFFER_ROWS: z.coerce.number().int().positive().default(50_000),
  WRITE_FLUSH_MS: z.coerce.number().int().positive().default(200),
  WRITE_FLUSH_ROWS: z.coerce.number().int().positive().default(500),
  PUBLISH_COALESCE_MS: z.coerce.number().int().positive().default(50),
  PUBLISH_COALESCE_MAX: z.coerce.number().int().positive().default(200),
  BULK_MAX_ITEMS: z.coerce.number().int().positive().default(1000),

  WS_BATCH_MS: z.coerce.number().int().positive().default(100),
  WS_MAX_BUFFERED_BYTES: z.coerce.number().int().positive().default(1_048_576),
  WS_CLIENT_QUEUE_MAX: z.coerce.number().int().positive().default(2000),
  WS_HEARTBEAT_MS: z.coerce.number().int().positive().default(30_000),

  RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  PARTITION_LOOKAHEAD_DAYS: z.coerce.number().int().positive().default(7),

  EXPORT_MAX_ROWS: z.coerce.number().int().positive().default(1_000_000),

  DASHBOARD_TOKEN: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
     
    console.error('Configuracion invalida:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
export type Config = typeof config;
