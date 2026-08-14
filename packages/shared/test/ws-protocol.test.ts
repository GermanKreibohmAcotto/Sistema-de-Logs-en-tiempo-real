import { describe, expect, it } from 'vitest';
import { clientMessageSchema, serverMessageSchema } from '../src/ws-protocol.js';

describe('clientMessageSchema', () => {
  it('defaults filters to {} on subscribe when omitted', () => {
    const result = clientMessageSchema.safeParse({ type: 'subscribe' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.type === 'subscribe' && result.data.filters).toEqual({});
  });

  it('accepts pause/resume/ping with no extra fields', () => {
    for (const type of ['pause', 'resume', 'ping']) {
      expect(clientMessageSchema.safeParse({ type }).success).toBe(true);
    }
  });

  it('rejects an unknown message type', () => {
    expect(clientMessageSchema.safeParse({ type: 'unsubscribe' }).success).toBe(false);
  });
});

describe('serverMessageSchema', () => {
  it('accepts a logs frame with a valid item', () => {
    const result = serverMessageSchema.safeParse({
      type: 'logs',
      items: [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          level: 'INFO',
          service: 'svc',
          message: 'hi',
          ingestedAt: new Date().toISOString(),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a logs frame with a malformed item', () => {
    const result = serverMessageSchema.safeParse({
      type: 'logs',
      items: [{ id: '1', level: 'NOT_A_LEVEL' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts a dropped frame', () => {
    expect(serverMessageSchema.safeParse({ type: 'dropped', count: 3 }).success).toBe(true);
  });
});
