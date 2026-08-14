import { describe, expect, it } from 'vitest';
import type { LogEvent } from '@logs/shared';
import { matchesFilter } from '../src/realtime/matcher.js';

function makeEvent(overrides: Partial<LogEvent> = {}): LogEvent {
  return {
    id: '1',
    timestamp: '2026-01-01T12:00:00.000Z',
    level: 'INFO',
    service: 'checkout',
    message: 'order placed successfully',
    metadata: null,
    traceId: null,
    ingestedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('matchesFilter', () => {
  it('matches everything when filters are empty', () => {
    expect(matchesFilter(makeEvent(), {})).toBe(true);
  });

  it('filters by level allowlist', () => {
    const event = makeEvent({ level: 'INFO' });
    expect(matchesFilter(event, { levels: ['ERROR', 'FATAL'] })).toBe(false);
    expect(matchesFilter(event, { levels: ['INFO', 'WARN'] })).toBe(true);
  });

  it('filters by service allowlist', () => {
    const event = makeEvent({ service: 'checkout' });
    expect(matchesFilter(event, { services: ['payments'] })).toBe(false);
    expect(matchesFilter(event, { services: ['checkout', 'payments'] })).toBe(true);
  });

  it('matches a substring search case-insensitively', () => {
    const event = makeEvent({ message: 'Connection TIMEOUT after 30s' });
    expect(matchesFilter(event, { q: 'timeout' })).toBe(true);
    expect(matchesFilter(event, { q: 'nope' })).toBe(false);
  });

  it('excludes events before the from bound', () => {
    const event = makeEvent({ timestamp: '2026-01-01T00:00:00.000Z' });
    expect(matchesFilter(event, { from: '2026-01-01T06:00:00.000Z' })).toBe(false);
  });

  it('excludes events after the to bound', () => {
    const event = makeEvent({ timestamp: '2026-01-02T00:00:00.000Z' });
    expect(matchesFilter(event, { to: '2026-01-01T23:59:59.000Z' })).toBe(false);
  });

  it('requires every provided condition to hold (AND semantics)', () => {
    const event = makeEvent({ level: 'ERROR', service: 'checkout', message: 'payment failed' });
    expect(matchesFilter(event, { levels: ['ERROR'], services: ['checkout'], q: 'failed' })).toBe(
      true,
    );
    expect(matchesFilter(event, { levels: ['ERROR'], services: ['payments'], q: 'failed' })).toBe(
      false,
    );
  });
});
