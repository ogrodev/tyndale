import { describe, it, expect } from 'bun:test';
import { countTokens, countEntryTokens } from '../../src/translate/tokenizer';

describe('countTokens', () => {
  it('returns a positive number for non-empty strings', () => {
    expect(countTokens('Hello')).toBeGreaterThan(0);
  });

  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns a reasonable count for "Hello world"', () => {
    const count = countTokens('Hello world');
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(5);
  });
});

describe('countEntryTokens', () => {
  it('returns more tokens than just the source', () => {
    const source = 'Hello world';
    const sourceOnly = countTokens(source);
    const entry = countEntryTokens('abc123', source);
    expect(entry).toBeGreaterThan(sourceOnly);
  });

  it('returns a consistent count across calls', () => {
    const first = countEntryTokens('hash1', 'some text');
    const second = countEntryTokens('hash1', 'some text');
    expect(first).toBe(second);
  });
});
