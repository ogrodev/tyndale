// packages/tyndale-next/tests/locale-utils.test.ts
import { describe, expect, test } from 'bun:test';
import {
  isRtlLocale,
  resolveAlias,
  parseAcceptLanguage,
  getDirection,
} from '../src/locale-utils';

describe('isRtlLocale', () => {
  test('returns true for Arabic', () => {
    expect(isRtlLocale('ar')).toBe(true);
  });

  test('returns true for Hebrew', () => {
    expect(isRtlLocale('he')).toBe(true);
  });

  test('returns true for Farsi', () => {
    expect(isRtlLocale('fa')).toBe(true);
  });

  test('returns true for Urdu', () => {
    expect(isRtlLocale('ur')).toBe(true);
  });

  test('returns true for Pashto', () => {
    expect(isRtlLocale('ps')).toBe(true);
  });

  test('returns true for Yiddish', () => {
    expect(isRtlLocale('yi')).toBe(true);
  });

  test('returns true for Aramaic', () => {
    expect(isRtlLocale('arc')).toBe(true);
  });

  test('returns false for English', () => {
    expect(isRtlLocale('en')).toBe(false);
  });

  test('returns false for Spanish', () => {
    expect(isRtlLocale('es')).toBe(false);
  });

  test('returns false for Japanese', () => {
    expect(isRtlLocale('ja')).toBe(false);
  });

  test('handles regional RTL variants (ar-SA)', () => {
    expect(isRtlLocale('ar-SA')).toBe(true);
  });

  test('handles regional LTR variants (en-US)', () => {
    expect(isRtlLocale('en-US')).toBe(false);
  });
});

describe('getDirection', () => {
  test('returns rtl for Arabic', () => {
    expect(getDirection('ar')).toBe('rtl');
  });

  test('returns ltr for English', () => {
    expect(getDirection('en')).toBe('ltr');
  });
});

describe('resolveAlias', () => {
  test('resolves known alias to canonical locale', () => {
    const aliases = { 'pt-BR': 'pt', 'en-US': 'en', 'zh-TW': 'zh-Hant' };
    expect(resolveAlias('pt-BR', aliases)).toBe('pt');
  });

  test('returns original locale when no alias exists', () => {
    const aliases = { 'pt-BR': 'pt' };
    expect(resolveAlias('es', aliases)).toBe('es');
  });

  test('returns original locale when aliases map is empty', () => {
    expect(resolveAlias('fr', {})).toBe('fr');
  });

  test('alias lookup is case-sensitive', () => {
    const aliases = { 'pt-BR': 'pt' };
    expect(resolveAlias('pt-br', aliases)).toBe('pt-br');
  });
});

describe('parseAcceptLanguage', () => {
  test('parses single locale', () => {
    expect(parseAcceptLanguage('en')).toEqual(['en']);
  });

  test('parses multiple locales sorted by quality', () => {
    expect(parseAcceptLanguage('fr;q=0.8, en;q=0.9, es;q=0.7')).toEqual([
      'en',
      'fr',
      'es',
    ]);
  });

  test('default quality is 1.0', () => {
    expect(parseAcceptLanguage('en, fr;q=0.9')).toEqual(['en', 'fr']);
  });

  test('handles complex Accept-Language with regions', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9,fr;q=0.8')).toEqual([
      'en-US',
      'en',
      'fr',
    ]);
  });

  test('returns empty array for empty string', () => {
    expect(parseAcceptLanguage('')).toEqual([]);
  });

  test('trims whitespace from locale codes', () => {
    expect(parseAcceptLanguage('  en , fr ;q=0.5')).toEqual(['en', 'fr']);
  });

  test('ignores wildcard *', () => {
    expect(parseAcceptLanguage('en, *, fr;q=0.5')).toEqual(['en', 'fr']);
  });
});
