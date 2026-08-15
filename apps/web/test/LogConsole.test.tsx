// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LogEvent } from '@logs/shared';
import { LogStore } from '../src/lib/log-store.js';
import { WsClient } from '../src/lib/ws-client.js';
import { LogConsole } from '../src/components/LogConsole.js';
import { installDomLayoutStubs } from './helpers/dom-layout.js';

// jsdom does not implement requestAnimationFrame; LogStore relies on it to
// coalesce notifications, so tests need a minimal stand-in (same approach as
// apps/web/test/log-store.test.ts).
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0)) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;
}

installDomLayoutStubs();
afterEach(cleanup);

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

async function seededStore(count: number, idPrefix = ''): Promise<LogStore> {
  const store = new LogStore();
  store.push(Array.from({ length: count }, (_, i) => makeEvent(`${idPrefix}${i}`)));
  await flushRaf();
  return store;
}

describe('LogConsole', () => {
  it('mounts far fewer DOM rows than a 10,000-item buffer (virtualization ceiling)', async () => {
    const store = await seededStore(10_000);
    const wsClient = new WsClient('ws://test');

    render(<LogConsole store={store} wsClient={wsClient} />);

    const rows = screen.getAllByTestId('log-row');
    // Not a trivial pass: with 10k items unmounted virtualization would mean
    // 10,000 rows, so this proves the virtualizer actually ran.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(120);
  });

  it('renders every mounted row wrapper at exactly the estimated 28px height', async () => {
    const store = await seededStore(50);
    const wsClient = new WsClient('ws://test');

    render(<LogConsole store={store} wsClient={wsClient} />);

    const rows = screen.getAllByTestId('log-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect((row as HTMLElement).style.height).toBe('28px');
    }
  });

  it('detaches from the bottom on scroll-up and shows the count of new rows since detach', async () => {
    const store = await seededStore(50);
    const wsClient = new WsClient('ws://test');

    render(<LogConsole store={store} wsClient={wsClient} />);

    // Pinned to bottom by default: no "Ir al final" control yet.
    expect(screen.queryByText(/Ir al final/)).toBeNull();

    const viewport = screen.getByTestId('log-viewport');
    fireEvent.scroll(viewport, { target: { scrollTop: 0 } });

    expect(screen.getByText('Ir al final')).toBeTruthy();

    store.push(Array.from({ length: 5 }, (_, i) => makeEvent(`new-${i}`)));
    await flushRaf();

    expect(screen.getByText('Ir al final (5 nuevos)')).toBeTruthy();
  });
});
