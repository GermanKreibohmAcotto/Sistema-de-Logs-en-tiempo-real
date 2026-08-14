import { z } from 'zod';
import { logLevelSchema } from './log.js';

/** One point in the events-per-minute timeseries, counts broken down by level. */
export const statsBucketSchema = z.object({
  bucketStart: z.string(),
  counts: z.record(logLevelSchema, z.number().int()),
});
export type StatsBucket = z.infer<typeof statsBucketSchema>;
