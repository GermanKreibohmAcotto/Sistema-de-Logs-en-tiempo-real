import { z } from 'zod';

export const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;

export const logLevelSchema = z.enum(LOG_LEVELS);
export type LogLevel = z.infer<typeof logLevelSchema>;

/** Rank used to compare severities (higher = more severe). */
export const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000; // +-24h

/** Payload accepted from producers on the ingest endpoints. */
export const logEventInputSchema = z.object({
  timestamp: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        const skew = Math.abs(Date.now() - new Date(value).getTime());
        return skew <= MAX_CLOCK_SKEW_MS;
      },
      { message: 'timestamp fuera de rango permitido (+-24h)' },
    ),
  level: logLevelSchema,
  service: z.string().min(1).max(128),
  message: z.string().min(1).max(16_384),
  metadata: z.record(z.string(), z.unknown()).optional(),
  traceId: z.string().max(128).optional(),
});
export type LogEventInput = z.infer<typeof logEventInputSchema>;

export const bulkLogEventInputSchema = z.array(logEventInputSchema).min(1).max(1000);

/** A log event as stored and returned by the API (server-assigned fields included). */
export const logEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: logLevelSchema,
  service: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  traceId: z.string().nullable().optional(),
  ingestedAt: z.string(),
});
export type LogEvent = z.infer<typeof logEventSchema>;
