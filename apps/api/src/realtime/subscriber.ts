import { z } from 'zod';
import { logEventSchema, type LogEvent } from '@logs/shared';
import { redisSub } from '../redis.js';
import { LOGS_STREAM_CHANNEL } from '../ingest/publisher.js';
import { logger } from '../logger.js';

const batchSchema = z.array(logEventSchema);

export type LogBatchHandler = (events: LogEvent[]) => void;

const handlers = new Set<LogBatchHandler>();

/** Registers a fan-out target (the WS gateway); returns an unsubscribe fn. */
export function onLogBatch(handler: LogBatchHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

let started = false;

/** Subscribes this process to the pub/sub channel the ingest API publishes to. */
export async function startLogSubscriber(): Promise<void> {
  if (started) return;
  started = true;

  await redisSub.subscribe(LOGS_STREAM_CHANNEL);
  redisSub.on('message', (channel: string, message: string) => {
    if (channel !== LOGS_STREAM_CHANNEL) return;
    let events: LogEvent[];
    try {
      events = batchSchema.parse(JSON.parse(message));
    } catch (err) {
      logger.warn({ err }, 'Mensaje invalido en logs:stream, se descarta');
      return;
    }
    for (const handler of handlers) handler(events);
  });
}
