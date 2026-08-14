import { LOG_LEVELS, type LogEvent, type StatsBucket } from '@logs/shared';
import { redisCmd } from '../redis.js';

const TTL_SECONDS = 2 * 60 * 60; // 2h of minute buckets covers any reasonable live-chart window
const KEY_PREFIX = 'logs:rate:';

function minuteBucketIso(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  d.setUTCSeconds(0, 0);
  return d.toISOString();
}

/**
 * Increments per-minute, per-level counters in Redis for every ingested
 * event. This is what powers the live "events per minute" chart - it reads
 * these counters, not Postgres, so the chart never adds query load to the
 * database while a burst is happening.
 */
export async function recordRateCounters(events: LogEvent[]): Promise<void> {
  if (events.length === 0) return;
  const pipeline = redisCmd.pipeline();
  const touchedKeys = new Set<string>();
  for (const event of events) {
    const key = `${KEY_PREFIX}${minuteBucketIso(event.timestamp)}`;
    pipeline.hincrby(key, event.level, 1);
    touchedKeys.add(key);
  }
  for (const key of touchedKeys) pipeline.expire(key, TTL_SECONDS);
  await pipeline.exec();
}

function emptyCounts(): StatsBucket['counts'] {
  const counts = {} as StatsBucket['counts'];
  for (const level of LOG_LEVELS) counts[level] = 0;
  return counts;
}

/** Reads the last `minutes` per-minute buckets, oldest first. */
export async function readRecentBuckets(minutes: number): Promise<StatsBucket[]> {
  const now = new Date();
  now.setUTCSeconds(0, 0);

  const bucketTimes: string[] = [];
  const pipeline = redisCmd.pipeline();
  for (let i = minutes - 1; i >= 0; i--) {
    const iso = new Date(now.getTime() - i * 60_000).toISOString();
    bucketTimes.push(iso);
    pipeline.hgetall(`${KEY_PREFIX}${iso}`);
  }

  const results = await pipeline.exec();
  return bucketTimes.map((bucketStart, index) => {
    const counts = emptyCounts();
    const entry = results?.[index];
    const data = entry?.[1] as Record<string, string> | undefined;
    if (!entry?.[0] && data) {
      for (const [level, countStr] of Object.entries(data)) {
        if (level in counts) counts[level as keyof StatsBucket['counts']] = Number(countStr);
      }
    }
    return { bucketStart, counts };
  });
}
