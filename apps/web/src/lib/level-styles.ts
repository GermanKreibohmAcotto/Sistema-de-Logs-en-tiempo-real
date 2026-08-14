import type { LogLevel } from '@logs/shared';

export const LEVEL_BADGE_CLASSES: Record<LogLevel, string> = {
  DEBUG: 'bg-slate-700 text-slate-200',
  INFO: 'bg-sky-900 text-sky-200',
  WARN: 'bg-amber-900 text-amber-200',
  ERROR: 'bg-red-900 text-red-200',
  FATAL: 'bg-fuchsia-900 text-fuchsia-100',
};

export const LEVEL_CHART_COLORS: Record<LogLevel, string> = {
  DEBUG: '#64748b',
  INFO: '#38bdf8',
  WARN: '#f59e0b',
  ERROR: '#ef4444',
  FATAL: '#d946ef',
};
