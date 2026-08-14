import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LOG_LEVELS } from '@logs/shared';
import type { StatsBucket } from '@logs/shared';
import { LEVEL_CHART_COLORS } from '../lib/level-styles';

function formatBucketTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

/** Stacked area chart of events/minute by severity. Fed by the WS `stats`
 * frame in Live mode (server-side counters, no DB hit) or by
 * GET /v1/stats/timeseries in Historical mode. */
export function RateChart({ buckets }: { buckets: StatsBucket[] }) {
  const data = buckets.map((b) => ({ time: formatBucketTime(b.bucketStart), ...b.counts }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} minTickGap={30} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 12 }}
          labelStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {LOG_LEVELS.map((level) => (
          <Area
            key={level}
            type="monotone"
            dataKey={level}
            stackId="1"
            stroke={LEVEL_CHART_COLORS[level]}
            fill={LEVEL_CHART_COLORS[level]}
            fillOpacity={0.55}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
