import { describe, expect, it } from 'vitest';
import { applyModeChange } from '../src/lib/view-mode.js';

describe('applyModeChange', () => {
  it('clears from/to and sets mode to live when switching to live', () => {
    const result = applyModeChange('live', { from: '2026-01-01T00:00', to: '2026-01-02T00:00' });
    expect(result).toEqual({ mode: 'live', range: { from: '', to: '' } });
  });

  it('preserves the existing from/to range when switching to historical', () => {
    const range = { from: '2026-03-05T10:00', to: '2026-03-06T10:00' };
    const result = applyModeChange('historical', range);
    expect(result).toEqual({ mode: 'historical', range });
  });
});
