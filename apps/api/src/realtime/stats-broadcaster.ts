import { readRecentBuckets } from '../ingest/rate-counters.js';
import { pushStatsBuckets } from './gateway.js';
import { logger } from '../logger.js';

const BUCKET_WINDOW_MINUTES = 60;
const BROADCAST_INTERVAL_MS = 5000;

/** Pushes the last hour of per-minute counters to every connected client every 5s. */
export function startStatsBroadcaster(): () => void {
  const handle = setInterval(() => {
    readRecentBuckets(BUCKET_WINDOW_MINUTES)
      .then((buckets) => pushStatsBuckets(buckets))
      .catch((err) => logger.warn({ err }, 'Fallo al calcular las estadisticas en vivo'));
  }, BROADCAST_INTERVAL_MS);
  handle.unref();
  return () => clearInterval(handle);
}
