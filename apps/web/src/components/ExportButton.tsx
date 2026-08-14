import { useState } from 'react';
import { exportUrl, type LogFilterParams } from '../lib/api';

type ExportFormat = 'csv' | 'json' | 'ndjson';

/** Exports exactly the currently-applied filters - what you see is what you download. */
export function ExportButton({ filters }: { filters: LogFilterParams }) {
  const [format, setFormat] = useState<ExportFormat>('csv');

  function handleExport(): void {
    // Content-Disposition: attachment means the browser downloads this
    // instead of navigating away, so a plain location change is enough.
    window.location.href = exportUrl({ ...filters, format });
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as ExportFormat)}
        className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-100"
      >
        <option value="csv">CSV</option>
        <option value="json">JSON</option>
        <option value="ndjson">NDJSON</option>
      </select>
      <button
        onClick={handleExport}
        className="rounded bg-indigo-800 px-2 py-1 text-xs font-semibold text-indigo-50 hover:bg-indigo-700"
      >
        Exportar
      </button>
    </div>
  );
}
