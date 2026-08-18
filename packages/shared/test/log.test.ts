import { describe, expect, it } from 'vitest';
import { logEventInputSchema, bulkLogEventInputSchema } from '../src/log.js';

describe('logEventInputSchema', () => {
  it('accepts a minimal valid event', () => {
    const result = logEventInputSchema.safeParse({
      level: 'INFO',
      service: 'checkout',
      message: 'order placed',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown level', () => {
    const result = logEventInputSchema.safeParse({
      level: 'TRACE',
      service: 'checkout',
      message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty message', () => {
    const result = logEventInputSchema.safeParse({
      level: 'INFO',
      service: 'checkout',
      message: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a timestamp far outside the +-24h clock-skew tolerance', () => {
    const result = logEventInputSchema.safeParse({
      level: 'INFO',
      service: 'checkout',
      message: 'x',
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a timestamp within the tolerance', () => {
    const result = logEventInputSchema.safeParse({
      level: 'INFO',
      service: 'checkout',
      message: 'x',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe('bulkLogEventInputSchema', () => {
  it('rejects an empty array', () => {
    expect(bulkLogEventInputSchema.safeParse([]).success).toBe(false);
  });

  it('rejects more than 1000 items', () => {
    const items = Array.from({ length: 1001 }, () => ({
      level: 'INFO',
      service: 'svc',
      message: 'x',
    }));
    expect(bulkLogEventInputSchema.safeParse(items).success).toBe(false);
  });

  it('accepts exactly 1000 items', () => {
    const items = Array.from({ length: 1000 }, () => ({
      level: 'INFO',
      service: 'svc',
      message: 'x',
    }));
    expect(bulkLogEventInputSchema.safeParse(items).success).toBe(true);
  });
});
