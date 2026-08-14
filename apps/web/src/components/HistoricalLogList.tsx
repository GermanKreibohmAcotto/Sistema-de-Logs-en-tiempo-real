import { useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { LogEvent } from '@logs/shared';
import { fetchLogs, type LogFilterParams } from '../lib/api';
import { LogRow } from './LogRow';

const ROW_HEIGHT = 28;
const PAGE_SIZE = 100;

/**
 * Historical view: cursor-paginated over GET /v1/logs, loading the next page
 * automatically as an IntersectionObserver sentinel at the bottom of the
 * virtualized list scrolls into view. `requestSeq` guards against a slow,
 * now-superseded request (e.g. from filters that changed mid-flight)
 * overwriting the results of a newer one.
 */
export function HistoricalLogList({ filters }: { filters: LogFilterParams }) {
  const filterKey = JSON.stringify(filters);

  const [items, setItems] = useState<LogEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);
  const cursorRef = useRef<string | null>(null);
  cursorRef.current = cursor;

  const loadPage = useCallback(
    async (reset: boolean) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchLogs({
          ...filters,
          cursor: reset ? undefined : (cursorRef.current ?? undefined),
          limit: PAGE_SIZE,
        });
        if (seq !== requestSeq.current) return;
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setCursor(res.nextCursor);
        setExhausted(res.nextCursor === null);
      } catch (err) {
        if (seq === requestSeq.current) setError((err as Error).message);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    // Intentionally keyed on filterKey (a stable JSON string), not `filters`
    // itself, since a new object reference each render would recreate this
    // callback every time and defeat the IntersectionObserver effect below.
    [filterKey],
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setExhausted(false);
    void loadPage(true);
  }, [filterKey, loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = parentRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !exhausted) {
          void loadPage(false);
        }
      },
      { root, rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPage, loading, exhausted]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
        <span>
          {items.length.toLocaleString('es-AR')} resultados{exhausted ? ' (fin)' : ''}
        </span>
        {error && <span className="text-red-400">Error: {error}</span>}
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {items.length === 0 && !loading ? (
          <p className="p-4 text-sm text-slate-500">Sin resultados para estos filtros.</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = items[virtualRow.index];
              if (!event) return null;
              return (
                <div
                  key={event.id}
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
        <div ref={sentinelRef} className="h-4" />
        {loading && <p className="p-3 text-center text-xs text-slate-500">Cargando...</p>}
      </div>
    </div>
  );
}
