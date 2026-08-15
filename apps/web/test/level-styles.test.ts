import { describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '@logs/shared';
import {
  CHART_CHROME,
  LEVEL_ACCENT_CLASSES,
  LEVEL_CHART_COLORS,
  LEVEL_CHIP_CLASSES,
  LEVEL_ROW_CLASSES,
  LEVEL_TEXT_CLASSES,
} from '../src/lib/level-styles.js';
import { ROW_HEIGHT, ROW_HEIGHT_CLASS } from '../src/lib/row-metrics.js';

const LEVEL_MAPS = {
  LEVEL_TEXT_CLASSES,
  LEVEL_ROW_CLASSES,
  LEVEL_ACCENT_CLASSES,
  LEVEL_CHIP_CLASSES,
  LEVEL_CHART_COLORS,
} as const;

describe('level-styles token maps', () => {
  it.each(Object.entries(LEVEL_MAPS))('%s has an entry for every LOG_LEVEL', (_name, map) => {
    for (const level of LOG_LEVELS) {
      expect(Object.prototype.hasOwnProperty.call(map, level)).toBe(true);
    }
  });

  it('CHART_CHROME values all resolve through a CSS custom property, never a literal', () => {
    const values = Object.values(CHART_CHROME);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value.startsWith('var(--')).toBe(true);
    }
  });
});

describe('row-metrics constants', () => {
  it('ROW_HEIGHT is 28, the shared estimateSize/wrapper/rendered-height invariant', () => {
    expect(ROW_HEIGHT).toBe(28);
  });

  it('ROW_HEIGHT_CLASS is the h-7 utility matching 28px at the default 4px scale', () => {
    expect(ROW_HEIGHT_CLASS).toBe('h-7');
  });
});
