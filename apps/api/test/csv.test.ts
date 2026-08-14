import { describe, expect, it } from 'vitest';
import { csvEscape } from '../src/export/csv.js';

describe('csvEscape', () => {
  it('leaves a plain field untouched', () => {
    expect(csvEscape('order placed')).toBe('order placed');
  });

  it('quotes a field containing a comma', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('quotes and doubles embedded quotes', () => {
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes a field containing a carriage return', () => {
    expect(csvEscape('a\rb')).toBe('"a\rb"');
  });

  it('round-trips a message that looks like a log line with metadata', () => {
    const message = 'request failed, retrying "GET /x", took 12ms';
    const escaped = csvEscape(message);
    expect(escaped.startsWith('"')).toBe(true);
    expect(escaped).toContain('""GET /x""');
  });
});
