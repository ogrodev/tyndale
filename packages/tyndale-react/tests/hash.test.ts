import { describe, expect, it } from 'bun:test';
import { computeHash } from '../src/hash.js';

describe('computeHash', () => {
  it('returns a hex string', () => {
    const hash = computeHash('Hello world');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const a = computeHash('Welcome to our app');
    const b = computeHash('Welcome to our app');
    expect(a).toBe(b);
  });

  it('produces different hashes for different content', () => {
    const a = computeHash('Hello');
    const b = computeHash('Goodbye');
    expect(a).not.toBe(b);
  });

  it('normalizes whitespace — collapses runs of whitespace to single space', () => {
    const a = computeHash('Hello   world');
    const b = computeHash('Hello world');
    expect(a).toBe(b);
  });

  it('normalizes whitespace — trims leading and trailing', () => {
    const a = computeHash('  Hello world  ');
    const b = computeHash('Hello world');
    expect(a).toBe(b);
  });

  it('normalizes whitespace — collapses newlines and tabs', () => {
    const a = computeHash('Hello\n\t\tworld');
    const b = computeHash('Hello world');
    expect(a).toBe(b);
  });

  it('preserves meaningful content differences', () => {
    const a = computeHash('Hello world');
    const b = computeHash('Helloworld');
    expect(a).not.toBe(b);
  });

  it('handles empty string', () => {
    const hash = computeHash('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
