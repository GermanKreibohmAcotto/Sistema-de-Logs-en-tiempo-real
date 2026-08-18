// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@logs/shared';
import { LogStore } from '../src/lib/log-store.js';

// jsdom does not implement requestAnimationFrame; LogStore relies on it to
// coalesce notifications, so tests need a minimal stand-in.
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0)) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id)) as typeof cancelAnimationFrame;
}

function makeEvent(id: string): LogEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    level: 'INFO',
    service: 'svc',
    message: `msg-${id}`,
    metadata: null,
    traceId: null,
    ingestedAt: new Date().toISOString(),
  };
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('LogStore', () => {
  it('starts empty', () => {
    const store = new LogStore();
    expect(store.getSnapshot()).toEqual([]);
  });

  it('buffers pushed events and only exposes them after the next animation frame', async () => {
    const store = new LogStore();
    store.push([makeEvent('1'), makeEvent('2')]);
    expect(store.getSnapshot()).toEqual([]);
    await flushRaf();
    expect(store.getSnapshot().map((e) => e.id)).toEqual(['1', '2']);
  });

  it('coalesces multiple pushes within the same frame into a single notification', async () => {
    const store = new LogStore();
    let notifications = 0;
    store.subscribe(() => notifications++);

    store.push([makeEvent('1')]);
    store.push([makeEvent('2')]);
    store.push([makeEvent('3')]);

    await flushRaf();
    expect(notifications).toBe(1);
    expect(store.getSnapshot()).toHaveLength(3);
  });

  it('caps the ring buffer at 10000 and drops the oldest entries, not the newest', async () => {
    const store = new LogStore();
    const events = Array.from({ length: 10_050 }, (_, i) => makeEvent(String(i)));
    store.push(events);
    await flushRaf();

    const snapshot = store.getSnapshot();
    expect(snapshot).toHaveLength(10_000);
    expect(store.droppedCount).toBe(50);
    expect(snapshot[0]?.id).toBe('50');
    expect(snapshot[9_999]?.id).toBe('10049');
  });

  it('records server-reported drops separately from local ring-buffer overflow', () => {
    const store = new LogStore();
    store.recordServerDropped(5);
    expect(store.droppedCount).toBe(5);
  });

  it('clear() empties the buffer and resets the dropped counter', async () => {
    const store = new LogStore();
    store.push([makeEvent('1')]);
    store.recordServerDropped(3);
    await flushRaf();

    store.clear();
    await flushRaf();

    expect(store.getSnapshot()).toEqual([]);
    expect(store.droppedCount).toBe(0);
  });

  it('stops notifying after unsubscribe', async () => {
    const store = new LogStore();
    let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    unsubscribe();

    store.push([makeEvent('1')]);
    await flushRaf();

    expect(notifications).toBe(0);
  });
});
