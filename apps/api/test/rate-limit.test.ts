import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Mocks redis.ts entirely so importing this file never touches the real
 * ioredis client (and, transitively, config.ts). The factory reimplements
 * the same token-bucket math as the Lua script in plugins/rate-limit.ts,
 * against an in-memory bucket keyed by the Redis key - this verifies the
 * TS-side contract (allowed flag, remaining, retryAfterSeconds) faithfully,
 * though it does not exercise the actual Lua script's atomicity guarantees;
 * that is covered by the integration suite once Postgres/Redis are up.
 *
 * Everything the mock needs lives inside the factory itself (not as
 * outer-scope references) - Vitest hoists `vi.mock` above regular
 * top-level statements, so a factory that closed over an outer `const`
 * would hit the temporal dead zone. Each test below uses a distinct
 * apiKeyId instead of resetting bucket state between tests.
 */
vi.mock('../src/redis.js', () => {
  const buckets = new Map<string, { tokens: number; ts: number }>();

  function fakeEval(
    _script: string,
    _numkeys: number,
    key: string,
    capacity: number,
    refillRate: number,
    now: number,
    requested: number,
  ): [number, string] {
    const existing = buckets.get(key);
    const startTokens = existing?.tokens ?? capacity;
    const startTs = existing?.ts ?? now;

    const elapsed = Math.max(0, now - startTs);
    let tokens = Math.min(capacity, startTokens + elapsed * refillRate);
    let allowed = 0;
    if (tokens >= requested) {
      tokens -= requested;
      allowed = 1;
    }
    buckets.set(key, { tokens, ts: now });
    return [allowed, String(tokens)];
  }

  return {
    redisCmd: {
      eval: vi.fn((...args: unknown[]) =>
        Promise.resolve(fakeEval(...(args as Parameters<typeof fakeEval>))),
      ),
    },
  };
});

const { consumeTokens } = await import('../src/plugins/rate-limit.js');

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
});

describe('consumeTokens (token bucket)', () => {
  it('allows a request within capacity and reports remaining tokens', async () => {
    const result = await consumeTokens(101, 60, 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('blocks a bulk request that would exceed the bucket capacity', async () => {
    const result = await consumeTokens(102, 60, 100);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('costs N tokens for a batch of N logs, not 1 - the bulk-evasion case', async () => {
    // capacity 10/min: a single request for 10 logs should exhaust it in one shot.
    const first = await consumeTokens(103, 10, 10);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(0);

    const second = await consumeTokens(103, 10, 1);
    expect(second.allowed).toBe(false);
  });

  it('refills over time at capacity/60 tokens per second', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const drained = await consumeTokens(104, 60, 60);
    expect(drained.allowed).toBe(true);
    expect(drained.remaining).toBe(0);

    vi.spyOn(Date, 'now').mockReturnValue(10_000); // +10s -> +10 tokens at 60/min
    const afterRefill = await consumeTokens(104, 60, 5);
    expect(afterRefill.allowed).toBe(true);
    expect(afterRefill.remaining).toBe(5);
  });

  it('keeps separate buckets per API key id', async () => {
    await consumeTokens(105, 10, 10);
    const other = await consumeTokens(106, 10, 10);
    expect(other.allowed).toBe(true);
  });
});
