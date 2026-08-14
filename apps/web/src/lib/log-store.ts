import type { LogEvent } from '@logs/shared';

const CAPACITY = 10_000;

/**
 * Live logs live outside React state entirely. Feeding a `useState` array on
 * every WS frame is exactly what makes a log console freeze under load - every
 * push would trigger a full re-render synchronously. Instead this store
 * batches incoming events into a ring buffer and coalesces React
 * notifications to at most one per animation frame via `requestAnimationFrame`,
 * regardless of how many WS frames land in between. Combined with the
 * server's own 100ms batching, the real update ceiling is ~10/s.
 *
 * Consumed through `useSyncExternalStore` (see useLogStore below).
 */
export class LogStore {
  private buffer: LogEvent[] = [];
  private snapshot: LogEvent[] = [];
  private listeners = new Set<() => void>();
  private rafHandle: number | null = null;
  private droppedTotal = 0;

  push(events: LogEvent[]): void {
    if (events.length === 0) return;
    this.buffer.push(...events);
    if (this.buffer.length > CAPACITY) {
      const excess = this.buffer.length - CAPACITY;
      this.buffer.splice(0, excess);
      this.droppedTotal += excess;
    }
    this.scheduleNotify();
  }

  recordServerDropped(count: number): void {
    if (count <= 0) return;
    this.droppedTotal += count;
    this.scheduleNotify();
  }

  clear(): void {
    this.buffer = [];
    this.droppedTotal = 0;
    this.scheduleNotify();
  }

  get droppedCount(): number {
    return this.droppedTotal;
  }

  private scheduleNotify(): void {
    if (this.rafHandle !== null) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.snapshot = this.buffer.slice();
      for (const listener of this.listeners) listener();
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LogEvent[] => {
    return this.snapshot;
  };
}
