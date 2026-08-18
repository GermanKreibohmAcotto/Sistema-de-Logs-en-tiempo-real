// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { exportDownloadUrl } from '../src/lib/api.js';

describe('exportDownloadUrl', () => {
  it('resolves an empty base (production same-origin build) to an absolute URL', () => {
    // Regression: BASE_URL is "" in production (nginx serves same-origin,
    // see apps/web/Dockerfile), and `new URL()` throws on a relative string
    // without a base - this is exactly the case that broke the export button.
    const url = exportDownloadUrl({ format: 'csv' }, 't1', '');
    expect(url).toBe(`${window.location.origin}/v1/logs/export?format=csv&ticket=t1`);
  });

  it('respects an absolute base (dev build)', () => {
    const url = exportDownloadUrl({ format: 'json' }, 't1', 'http://localhost:4000');
    expect(url).toBe('http://localhost:4000/v1/logs/export?format=json&ticket=t1');
  });

  it('serializes applied filters and omits empty ones', () => {
    const url = exportDownloadUrl(
      {
        format: 'ndjson',
        levels: ['WARN', 'ERROR'],
        services: ['api'],
        q: 'timeout',
        from: undefined,
        to: undefined,
      },
      'abc123',
      '',
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get('levels')).toBe('WARN,ERROR');
    expect(parsed.searchParams.get('services')).toBe('api');
    expect(parsed.searchParams.get('q')).toBe('timeout');
    expect(parsed.searchParams.has('from')).toBe(false);
    expect(parsed.searchParams.has('to')).toBe(false);
    expect(parsed.searchParams.get('ticket')).toBe('abc123');
  });
});
