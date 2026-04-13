import { describe, it, expect } from 'bun:test';
import { suggestConcurrency, resolveConcurrency } from '../../src/translate/concurrency';

describe('suggestConcurrency', () => {
  it('returns a number between 4 and 16', () => {
    const result = suggestConcurrency();
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(16);
  });
});

describe('resolveConcurrency', () => {
  it('without args returns auto source', () => {
    const result = resolveConcurrency();
    expect(result.source).toBe('auto');
    expect(result.value).toBeGreaterThanOrEqual(4);
    expect(result.value).toBeLessThanOrEqual(16);
  });

  it('with positive number returns config source', () => {
    expect(resolveConcurrency(8)).toEqual({ value: 8, source: 'config' });
  });

  it('with 0 falls back to auto', () => {
    const result = resolveConcurrency(0);
    expect(result.source).toBe('auto');
  });

  it('with undefined returns auto source', () => {
    const result = resolveConcurrency(undefined);
    expect(result.source).toBe('auto');
  });
});
