import { describe, expect, it } from 'vitest';
import { logQuerySchema, logListQuerySchema } from '../src/filters.js';

describe('logQuerySchema', () => {
  it('accepts a real JSON array (as sent over the WS subscribe message)', () => {
    const result = logQuerySchema.safeParse({ levels: ['WARN', 'ERROR'] });
    expect(result.success).toBe(true);
    expect(result.success && result.data.levels).toEqual(['WARN', 'ERROR']);
  });

  it('splits a comma-separated string (as sent in a REST query string)', () => {
    const result = logQuerySchema.safeParse({ levels: 'WARN,ERROR' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.levels).toEqual(['WARN', 'ERROR']);
  });

  it('trims whitespace around comma-separated values', () => {
    const result = logQuerySchema.safeParse({ services: 'api , worker ,  cron' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.services).toEqual(['api', 'worker', 'cron']);
  });

  it('rejects an invalid level inside a comma-separated string', () => {
    const result = logQuerySchema.safeParse({ levels: 'WARN,NOPE' });
    expect(result.success).toBe(false);
  });

  it('leaves levels undefined when omitted', () => {
    const result = logQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.success && result.data.levels).toBeUndefined();
  });
});

describe('logListQuerySchema', () => {
  it('defaults limit to 100', () => {
    const result = logListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.success && result.data.limit).toBe(100);
  });

  it('rejects a limit above 500', () => {
    expect(logListQuerySchema.safeParse({ limit: 501 }).success).toBe(false);
  });

  it('coerces a query-string limit to a number', () => {
    const result = logListQuerySchema.safeParse({ limit: '250' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.limit).toBe(250);
  });
});
