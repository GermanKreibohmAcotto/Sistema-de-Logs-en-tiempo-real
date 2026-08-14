import { z } from 'zod';
import { logLevelSchema } from './log.js';

/**
 * Query-string values arrive as comma-separated strings (`?levels=WARN,ERROR`);
 * WS `subscribe` messages send real JSON arrays. This accepts both so the
 * same schema validates a REST query and a WS filter payload unchanged.
 */
function csvOrArray<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return value;
  }, z.array(schema));
}

/**
 * Filter shape shared by the REST query endpoint, the export endpoint and the
 * WebSocket `subscribe` message, so both live and historical views speak the
 * same language.
 */
export const logQuerySchema = z.object({
  levels: csvOrArray(logLevelSchema).optional(),
  services: csvOrArray(z.string()).optional(),
  q: z.string().max(256).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
export type LogQuery = z.infer<typeof logQuerySchema>;

export const logListQuerySchema = logQuerySchema.extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type LogListQuery = z.infer<typeof logListQuerySchema>;

export const exportFormatSchema = z.enum(['csv', 'json', 'ndjson']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const exportQuerySchema = logQuerySchema.extend({
  format: exportFormatSchema.default('csv'),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
