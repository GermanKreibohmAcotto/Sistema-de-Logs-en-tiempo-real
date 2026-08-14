import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogClient } from '../src/index.js';

function jsonResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('LogClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call fetch until flushed', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202));
    const client = new LogClient({ url: 'http://api.test', apiKey: 'k', flushIntervalMs: 60_000 });
    client.info('svc', 'hola');
    expect(fetchMock).not.toHaveBeenCalled();
    await client.close(); // close() flushes the pending event - the mock above is what it hits.
  });

  it('auto-flushes once maxBatchSize is reached', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, { accepted: 2 }));
    const client = new LogClient({ url: 'http://api.test', apiKey: 'k', maxBatchSize: 2, flushIntervalMs: 60_000 });
    client.info('svc', 'uno');
    client.info('svc', 'dos');
    // log() fires the flush but doesn't await it - give the microtask a tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/logs/bulk');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('k');
    expect(JSON.parse(init.body as string)).toHaveLength(2);
    await client.close();
  });

  it('retries on 5xx and eventually succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503))
      .mockResolvedValueOnce(jsonResponse(202, { accepted: 1 }));
    const client = new LogClient({
      url: 'http://api.test',
      apiKey: 'k',
      flushIntervalMs: 60_000,
      maxRetries: 3,
    });
    client.info('svc', 'reintenta');
    await client.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await client.close();
  });

  it('respects Retry-After on 429', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, {}, { 'retry-after': '1' }))
      .mockResolvedValueOnce(jsonResponse(202));
    const client = new LogClient({ url: 'http://api.test', apiKey: 'k', flushIntervalMs: 60_000 });
    client.info('svc', 'rate limited');

    const start = Date.now();
    await client.flush();
    expect(Date.now() - start).toBeGreaterThanOrEqual(950);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await client.close();
  });

  it('drops the batch and calls onError after exhausting retries, without throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500));
    const onError = vi.fn();
    const client = new LogClient({
      url: 'http://api.test',
      apiKey: 'k',
      flushIntervalMs: 60_000,
      maxRetries: 1,
      onError,
    });
    client.info('svc', 'se va a perder');
    await expect(client.flush()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2); // intento inicial + 1 reintento
    expect(onError).toHaveBeenCalledTimes(1);
    await client.close();
  });

  it('never throws when fetch itself rejects (network down)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const onError = vi.fn();
    const client = new LogClient({
      url: 'http://api.test',
      apiKey: 'k',
      flushIntervalMs: 60_000,
      maxRetries: 0,
      onError,
    });
    client.info('svc', 'sin red');
    await expect(client.flush()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    await client.close();
  });

  it('close() flushes remaining events and stops the timer', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202));
    const client = new LogClient({ url: 'http://api.test', apiKey: 'k', flushIntervalMs: 60_000 });
    client.info('svc', 'ultimo');
    await client.close();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    client.info('svc', 'post-close, se ignora');
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
