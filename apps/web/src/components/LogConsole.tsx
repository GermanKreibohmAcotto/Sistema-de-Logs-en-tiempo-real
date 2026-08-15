import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LogStore } from '../lib/log-store';
import type { WsClient } from '../lib/ws-client';
import { COLUMN_CLASSES, ROW_HEIGHT, ROW_HEIGHT_CLASS } from '../lib/row-metrics';
import { LogRow } from './LogRow';

const BOTTOM_ANCHOR_THRESHOLD_PX = 48;

/**
 * Live console. Only ~40 rows are ever mounted in the DOM regardless of
 * buffer size (react-virtual), and auto-scroll only follows the stream while
 * the user is already pinned to the bottom - scrolling up to inspect a burst
 * detaches it instead of fighting the user for control of the viewport.
 */
export function LogConsole({ store, wsClient }: { store: LogStore; wsClient: WsClient }) {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [paused, setPaused] = useState(false);
  const [missed, setMissed] = useState(0);
  const [_droppedTick, setDroppedTick] = useState(0);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [unpinnedAtLength, setUnpinnedAtLength] = useState<number | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const offPaused = wsClient.onPaused((m) => setMissed(m));
    const offDropped = wsClient.onDropped(() => setDroppedTick((t) => t + 1));
    return () => {
      offPaused();
      offDropped();
    };
  }, [wsClient]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  useEffect(() => {
    if (pinnedToBottom && items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
    }
  }, [items.length, pinnedToBottom, virtualizer]);

  function handleScroll(): void {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < BOTTOM_ANCHOR_THRESHOLD_PX;
    setPinnedToBottom((wasPinned) => {
      if (wasPinned && !atBottom) setUnpinnedAtLength(items.length);
      if (!wasPinned && atBottom) setUnpinnedAtLength(null);
      return atBottom;
    });
  }

  function jumpToBottom(): void {
    setPinnedToBottom(true);
    setUnpinnedAtLength(null);
  }

  function togglePause(): void {
    if (paused) {
      wsClient.resume();
      setPaused(false);
    } else {
      wsClient.pause();
      setPaused(true);
      setMissed(0);
    }
  }

  const newSinceUnpin = unpinnedAtLength === null ? 0 : Math.max(0, items.length - unpinnedAtLength);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-lowest">
      {/* Fixed height so no degraded state (paused, dropped, detached) ever shifts the viewport. */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-outline-variant/40 px-3 text-xs text-on-surface-variant">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePause}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
              paused
                ? 'bg-tertiary-container text-on-tertiary-container'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-high'
            }`}
          >
            {paused ? `Reanudar${missed ? ` (${missed} perdidos)` : ''}` : 'Pausar'}
          </button>
          <span>{items.length.toLocaleString('es-AR')} en buffer</span>
          {store.droppedCount > 0 && (
            <span className="text-tertiary">
              {store.droppedCount.toLocaleString('es-AR')} descartados por saturacion
            </span>
          )}
        </div>
        {!pinnedToBottom && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="rounded-md bg-primary-container px-2 py-1 text-[11px] font-semibold text-on-primary hover:bg-primary"
          >
            Ir al final{newSinceUnpin > 0 ? ` (${newSinceUnpin} nuevos)` : ''}
          </button>
        )}
      </div>

      <div
        className={`flex shrink-0 items-center gap-3 border-b border-outline-variant/40 px-3 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/60 ${ROW_HEIGHT_CLASS}`}
      >
        <span className={COLUMN_CLASSES.time}>Hora</span>
        <span className={COLUMN_CLASSES.level}>Nivel</span>
        <span className={COLUMN_CLASSES.service}>Servicio</span>
        <span className={COLUMN_CLASSES.message}>Mensaje</span>
      </div>

      <div ref={parentRef} onScroll={handleScroll} data-testid="log-viewport" className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-on-surface-variant/60">Esperando logs...</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = items[virtualRow.index];
              if (!event) return null;
              return (
                <div
                  key={event.id}
                  data-testid="log-row"
                  className={ROW_HEIGHT_CLASS}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <LogRow event={event} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
