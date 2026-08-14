import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogLevel, StatsBucket } from '@logs/shared';
import { LogStore } from './lib/log-store';
import { WsClient, type ConnectionStatus } from './lib/ws-client';
import { fetchTimeseries, type LogFilterParams } from './lib/api';
import { FilterBar } from './components/FilterBar';
import { LogConsole } from './components/LogConsole';
import { HistoricalLogList } from './components/HistoricalLogList';
import { RateChart } from './components/RateChart';
import { AlertsPanel } from './components/AlertsPanel';
import { ExportButton } from './components/ExportButton';
import { ConnectionBanner } from './components/ConnectionBanner';

/**
 * `new WebSocket(url)` requires an absolute ws(s):// URL - unlike fetch, a
 * relative path throws. In dev, VITE_WS_URL is already absolute
 * (ws://localhost:4000/ws). In production behind nginx (see apps/web/Dockerfile),
 * it's set to the relative "/ws" so the same build works regardless of the
 * deployed hostname; resolve that against the page's own origin at runtime.
 */
function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured && /^wss?:\/\//.test(configured)) return configured;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const path = configured?.startsWith('/') ? configured : '/ws';
  return `${protocol}://${window.location.host}${path}`;
}

const WS_URL = resolveWsUrl();

function toIsoOrUndefined(datetimeLocalValue: string): string | undefined {
  if (!datetimeLocalValue) return undefined;
  return new Date(datetimeLocalValue).toISOString();
}

export default function App() {
  const storeRef = useRef(new LogStore());
  const wsClientRef = useRef(new WsClient(WS_URL));

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [levels, setLevels] = useState<LogLevel[]>([]);
  const [servicesInput, setServicesInput] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mode, setMode] = useState<'live' | 'historical'>('live');
  const [buckets, setBuckets] = useState<StatsBucket[]>([]);

  useEffect(() => {
    const wsClient = wsClientRef.current;
    const store = storeRef.current;
    wsClient.connect();
    const offStatus = wsClient.onStatus(setStatus);
    const offLogs = wsClient.onLogs((items) => store.push(items));
    const offDropped = wsClient.onDropped((count) => store.recordServerDropped(count));
    const offStats = wsClient.onStats(setBuckets);
    return () => {
      offStatus();
      offLogs();
      offDropped();
      offStats();
      wsClient.close();
    };
  }, []);

  // Debounce search text so keystrokes don't each trigger a WS re-subscribe
  // or a historical refetch.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(handle);
  }, [q]);

  // Picking a date range only makes sense against the historical query -
  // filtering "yesterday" on a live stream is not a coherent action.
  useEffect(() => {
    if (from || to) setMode('historical');
  }, [from, to]);

  const servicesArray = useMemo(
    () =>
      servicesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [servicesInput],
  );

  const filters: LogFilterParams = useMemo(
    () => ({
      levels: levels.length > 0 ? levels : undefined,
      services: servicesArray.length > 0 ? servicesArray : undefined,
      q: debouncedQ || undefined,
      from: mode === 'historical' ? toIsoOrUndefined(from) : undefined,
      to: mode === 'historical' ? toIsoOrUndefined(to) : undefined,
    }),
    [levels, servicesArray, debouncedQ, from, to, mode],
  );

  useEffect(() => {
    if (mode === 'live') {
      wsClientRef.current.subscribe({
        levels: filters.levels,
        services: filters.services,
        q: filters.q,
      });
    }
  }, [mode, filters]);

  useEffect(() => {
    if (mode !== 'historical') return;
    let cancelled = false;
    fetchTimeseries(filters)
      .then((res) => {
        if (!cancelled) setBuckets(res.buckets);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mode, filters]);

  function handleBackToLive(): void {
    setFrom('');
    setTo('');
    setMode('live');
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-slate-200">Monitoreo de Logs en Tiempo Real</h1>
        <div className="flex items-center gap-4">
          <ConnectionBanner status={status} />
          <ExportButton filters={filters} />
        </div>
      </header>

      <FilterBar
        levels={levels}
        onLevelsChange={setLevels}
        services={servicesInput}
        onServicesChange={setServicesInput}
        q={q}
        onQChange={setQ}
        from={from}
        onFromChange={setFrom}
        to={to}
        onToChange={setTo}
        mode={mode}
        onBackToLive={handleBackToLive}
      />

      <div className="h-44 shrink-0 border-b border-slate-800 px-4 py-2">
        <RateChart buckets={buckets} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {mode === 'live' ? (
            <LogConsole store={storeRef.current} wsClient={wsClientRef.current} />
          ) : (
            <HistoricalLogList filters={filters} />
          )}
        </div>
        <aside className="w-80 shrink-0 border-l border-slate-800">
          <AlertsPanel wsClient={wsClientRef.current} />
        </aside>
      </div>
    </div>
  );
}
