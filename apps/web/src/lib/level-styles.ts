import type { LogLevel } from '@logs/shared';

/**
 * In a dense stream the level reads as coloured monospace text rather than a
 * chip, so nothing competes with the message itself - except FATAL, which
 * inverts into a solid block precisely because it should interrupt scanning.
 */
export const LEVEL_TEXT_CLASSES: Record<LogLevel, string> = {
  DEBUG: 'text-secondary',
  INFO: 'text-primary',
  WARN: 'text-tertiary-container',
  ERROR: 'text-error',
  FATAL: 'bg-error text-on-error rounded-md px-1',
};

/** Row tint + left accent bar: only levels that warrant interrupting the eye. */
export const LEVEL_ROW_CLASSES: Record<LogLevel, string> = {
  DEBUG: '',
  INFO: '',
  WARN: 'bg-tertiary-container/10',
  ERROR: 'bg-error/10',
  FATAL: 'bg-error/20',
};

export const LEVEL_ACCENT_CLASSES: Record<LogLevel, string> = {
  DEBUG: '',
  INFO: '',
  WARN: '',
  ERROR: 'bg-error',
  FATAL: 'bg-error',
};

/** Filter chips are interactive, so they keep a tinted background when active. */
export const LEVEL_CHIP_CLASSES: Record<LogLevel, string> = {
  DEBUG: 'text-secondary bg-secondary/15',
  INFO: 'text-primary bg-primary/15',
  WARN: 'text-tertiary-container bg-tertiary-container/15',
  ERROR: 'text-error bg-error/15',
  FATAL: 'bg-error text-on-error',
};

export const LEVEL_CHART_COLORS: Record<LogLevel, string> = {
  DEBUG: '#4edea3',
  INFO: '#adc6ff',
  WARN: '#df7412',
  ERROR: '#ffb4ab',
  // Obsidian Flux gives FATAL no chart colour of its own - it reuses ERROR's
  // salmon inverted, which two stacked areas can't be told apart by. This is a
  // deliberate extension: more saturated than ERROR, so it reads as worse.
  FATAL: '#ff5449',
};

/**
 * Recharts chrome (grid, axis ticks, tooltip surface) reads its colours as
 * plain CSS strings, not utility classes, so it cannot pick up `@theme`
 * tokens through Tailwind class names the way JSX markup does. Resolving
 * each value through `var(--color-*)` keeps the chart in the same design
 * token discipline as everything else instead of hardcoding a hex here.
 */
export const CHART_CHROME = {
  grid: 'var(--color-outline-variant)',
  axis: 'var(--color-on-surface-variant)',
  tooltipBackground: 'var(--color-surface-container)',
  tooltipText: 'var(--color-on-surface)',
} as const;
