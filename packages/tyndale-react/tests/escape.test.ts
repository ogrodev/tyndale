import { describe, expect, it } from 'bun:test';
import { escapeWireFormat, unescapeWireFormat } from '../src/escape.js';

describe('escapeWireFormat', () => {
  it('escapes literal curly braces', () => {
    expect(escapeWireFormat('a {b} c')).toBe('a \\{b\\} c');
  });

  it('escapes literal backslashes', () => {
    expect(escapeWireFormat('a \\ b')).toBe('a \\\\ b');
  });

  it('escapes literal angle brackets', () => {
    expect(escapeWireFormat('a < b > c')).toBe('a &lt; b &gt; c');
  });

  it('escapes literal ampersand', () => {
    expect(escapeWireFormat('a & b')).toBe('a &amp; b');
  });

  it('escapes all special characters together', () => {
    expect(escapeWireFormat('x < y & z > {w} \\ q')).toBe(
      'x &lt; y &amp; z &gt; \\{w\\} \\\\ q'
    );
  });

  it('returns plain text unchanged', () => {
    expect(escapeWireFormat('Hello world')).toBe('Hello world');
  });

  it('handles empty string', () => {
    expect(escapeWireFormat('')).toBe('');
  });
});

describe('unescapeWireFormat', () => {
  it('unescapes entity-encoded angle brackets', () => {
    expect(unescapeWireFormat('a &lt; b &gt; c')).toBe('a < b > c');
  });

  it('unescapes entity-encoded ampersand', () => {
    expect(unescapeWireFormat('a &amp; b')).toBe('a & b');
  });

  it('unescapes backslash-escaped curly braces', () => {
    expect(unescapeWireFormat('a \\{b\\} c')).toBe('a {b} c');
  });

  it('unescapes escaped backslashes', () => {
    expect(unescapeWireFormat('a \\\\ b')).toBe('a \\ b');
  });

  it('unescapes all special characters together', () => {
    expect(unescapeWireFormat('x &lt; y &amp; z &gt; \\{w\\} \\\\ q')).toBe(
      'x < y & z > {w} \\ q'
    );
  });

  it('returns plain text unchanged', () => {
    expect(unescapeWireFormat('Hello world')).toBe('Hello world');
  });

  it('handles empty string', () => {
    expect(unescapeWireFormat('')).toBe('');
  });
});

describe('escaping round-trip', () => {
  const cases = [
    'Hello world',
    'price < 100 & quantity > 0',
    '{variableName}',
    'backslash: \\',
    'combo: <a> & {b} \\ c',
    'nested: \\{not a var\\}',
    '',
  ];

  for (const input of cases) {
    it(`round-trips: ${JSON.stringify(input)}`, () => {
      expect(unescapeWireFormat(escapeWireFormat(input))).toBe(input);
    });
  }
});
