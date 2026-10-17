import { describe, it, expect } from 'vitest';
import { isRetryable, normalizeModelOutput, GroqRequestError } from '../groq';

describe('isRetryable — controlled key failover', () => {
  it('never retries HTTP 400 (client/program errors)', () => {
    expect(isRetryable(new GroqRequestError('bad request', 400))).toBe(false);
    expect(isRetryable(new GroqRequestError('not found', 404))).toBe(false);
  });

  it('retries auth failures, rate limits and upstream 5xx', () => {
    expect(isRetryable(new GroqRequestError('x', 401))).toBe(true);
    expect(isRetryable(new GroqRequestError('x', 403))).toBe(true);
    expect(isRetryable(new GroqRequestError('x', 429))).toBe(true);
    expect(isRetryable(new GroqRequestError('x', 500))).toBe(true);
    expect(isRetryable(new GroqRequestError('x', 503))).toBe(true);
  });

  it('retries network/timeout errors (no status)', () => {
    expect(isRetryable(new GroqRequestError('fetch failed'))).toBe(true);
    expect(isRetryable(new Error('socket hangup'))).toBe(true);
  });
});

describe('normalizeModelOutput — output validation', () => {
  it('rejects non-string payloads', () => {
    expect(() => normalizeModelOutput(undefined)).toThrow();
    expect(() => normalizeModelOutput({ text: 'x' })).toThrow();
  });

  it('rejects empty payloads', () => {
    expect(() => normalizeModelOutput('   \n  ')).toThrow();
  });

  it('strips control characters and trims', () => {
    expect(normalizeModelOutput(' hello world ')).toBe('hello world');
  });

  it('preserves newlines and tabs', () => {
    expect(normalizeModelOutput('line1\nline2\ttabbed')).toBe('line1\nline2\ttabbed');
  });

  it('clamps runaway output to a safe length', () => {
    const flood = 'a'.repeat(50_000);
    expect(normalizeModelOutput(flood).length).toBeLessThanOrEqual(6000);
  });
});
