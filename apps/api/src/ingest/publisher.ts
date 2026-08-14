import { redisPub } from '../redis.js';
import { config } from '../config.js';
import type { LogEvent } from '@logs/shared';

export const LOGS_STREAM_CHANNEL = 'logs:stream';

/**
 * Coalesces individually-published events into arrays published every
 * PUBLISH_COALESCE_MS (or once PUBLISH_COALESCE_MAX events have queued),
 * so a 500 logs/s burst becomes ~10-20 pub/sub messages/s instead of 500.
 */
class Publisher {
  private queue: LogEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  push(event: LogEvent): void {
    this.queue.push(event);
    if (this.queue.length >= config.PUBLISH_COALESCE_MAX) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), config.PUBLISH_COALESCE_MS);
      this.timer.unref?.();
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    void redisPub.publish(LOGS_STREAM_CHANNEL, JSON.stringify(batch));
  }
}

export const publisher = new Publisher();
