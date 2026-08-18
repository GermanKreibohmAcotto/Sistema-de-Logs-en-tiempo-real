import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LOG_LEVELS } from '@logs/shared';
import type { StatsBucket } from '@logs/shared';
import { CHART_CHROME, LEVEL_CHART_COLORS } from '../lib/level-styles';

function formatBucketTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Stacked area chart of events/minute by severity. Fed by the WS `stats`
 * frame in Live mode (server-side counters, no DB hit) or by
 * GET /v1/stats/timeseries in Historical mode.
 *
 * Deviation from DESIGN.md's literal "10% opacity" gradient (user-approved):
 * five *stacked* areas at a flat 10% are mutually indistinguishable. Each
 * level gets its own `<linearGradient>` fading 0.45 -> 0.05 for depth, plus
 * a full-opacity 1.5px stroke that carries the boundary between bands.
 * `fillOpacity={1}` keeps the gradient's own stops as the sole opacity
 * source - Recharts' 0.6 default would otherwise multiply on top of them.
 */
export function RateChart({ buckets }: { buckets: StatsBucket[] }) {
  const data = buckets.map((b) => ({ time: formatBucketTime(b.bucketStart), ...b.counts }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {LOG_LEVELS.map((level) => (
            <linearGradient key={level} id={`rate-gradient-${level}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LEVEL_CHART_COLORS[level]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={LEVEL_CHART_COLORS[level]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_CHROME.grid} />
        <XAxis dataKey="time" tick={{ fill: CHART_CHROME.axis, fontSize: 10 }} minTickGap={30} />
        <YAxis tick={{ fill: CHART_CHROME.axis, fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: CHART_CHROME.tooltipBackground,
            border: `1px solid ${CHART_CHROME.grid}`,
            fontSize: 12,
          }}
          labelStyle={{ color: CHART_CHROME.tooltipText }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART_CHROME.tooltipText }} />
        {LOG_LEVELS.map((level) => (
          <Area
            key={level}
            type="monotone"
            dataKey={level}
            stackId="1"
            stroke={LEVEL_CHART_COLORS[level]}
            strokeWidth={1.5}
            strokeOpacity={1}
            fill={`url(#rate-gradient-${level})`}
            fillOpacity={1}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
