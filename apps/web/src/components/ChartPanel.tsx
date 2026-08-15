import type { StatsBucket } from '@logs/shared';
import { RateChart } from './RateChart';

/**
 * Owns the chart's surface, heading, margin and fixed height - panel
 * presentation, not shell geometry (design.md decision 5). `h-56 shrink-0`
 * keeps `App.tsx`'s outer `h-screen overflow-hidden` shell intact; only the
 * log viewport and alerts panel scroll internally, never this panel.
 */
export function ChartPanel({ buckets }: { buckets: StatsBucket[] }) {
  return (
    <div className="mx-4 mb-3 mt-3 flex h-56 shrink-0 flex-col gap-2 rounded-xl border border-outline-variant/40 bg-surface-container px-4 py-3">
      <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Eventos por minuto
      </h2>
      <div className="min-h-0 flex-1">
        <RateChart buckets={buckets} />
      </div>
    </div>
  );
}
