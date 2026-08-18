import { useState } from 'react';
import type { ExportFormat } from '@logs/shared';
import { exportDownloadUrl, requestExportTicket, type LogFilterParams } from '../lib/api';
import { IconDownload } from './icons';

/** Exports exactly the currently-applied filters - what you see is what you download. */
export function ExportButton({ filters }: { filters: LogFilterParams }) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      // The download is a browser navigation, so it can't carry the
      // x-dashboard-token header - mint a one-time ticket over a real fetch()
      // first and pass that instead (see apps/api/src/export/tickets.ts).
      const { ticket } = await requestExportTicket();
      const url = exportDownloadUrl({ ...filters, format }, ticket);
      // Content-Disposition: attachment means the browser downloads this
      // instead of navigating away, so a plain location change is enough.
      window.location.href = url;
    } catch {
      setError('No se pudo exportar. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        disabled={busy}
        className="rounded-md border border-outline-variant/40 bg-surface-highest px-1.5 py-1 text-xs text-on-surface disabled:opacity-60"
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
        <option value="ndjson">NDJSON</option>
      </select>
      <button
        onClick={() => void handleExport()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <IconDownload size={14} />
        {busy ? 'Exportando…' : 'Exportar'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}
