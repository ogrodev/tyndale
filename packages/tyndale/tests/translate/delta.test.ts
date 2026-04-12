// packages/tyndale/tests/translate/delta.test.ts
import { describe, it, expect } from 'bun:test';
import { computeDelta, type Delta, type Manifest, type LocaleData } from '../../src/translate/delta';

describe('computeDelta', () => {
  const manifest: Manifest = {
    version: 1,
    defaultLocale: 'en',
    locales: ['es', 'fr'],
    entries: {
      hash1: { type: 'jsx', context: 'app/page.tsx:T@12' },
      hash2: { type: 'string', context: 'app/page.tsx:useTranslation@8' },
      hash3: { type: 'jsx', context: 'app/about.tsx:T@5' },
    },
  };

  const defaultLocaleData: LocaleData = {
    hash1: 'Welcome to our app',
    hash2: 'Enter your email',
    hash3: 'About us',
  };

  it('all entries are new when locale file is empty', () => {
    const delta = computeDelta(manifest, defaultLocaleData, {});
    expect(delta.newHashes).toEqual(['hash1', 'hash2', 'hash3']);
    expect(delta.staleHashes).toEqual([]);
  });

  it('detects stale entries not in manifest', () => {
    const localeData: LocaleData = {
      hash1: 'Bienvenido',
      hash2: 'Ingrese',
      oldHash: 'Old translation',
    };
    const delta = computeDelta(manifest, defaultLocaleData, localeData);
    expect(delta.newHashes).toEqual(['hash3']);
    expect(delta.staleHashes).toEqual(['oldHash']);
  });

  it('no changes when locale matches manifest exactly', () => {
    const localeData: LocaleData = {
      hash1: 'Bienvenido',
      hash2: 'Ingrese',
      hash3: 'Sobre nosotros',
    };
    const delta = computeDelta(manifest, defaultLocaleData, localeData);
    expect(delta.newHashes).toEqual([]);
    expect(delta.staleHashes).toEqual([]);
  });

  it('handles mixed new and stale entries', () => {
    const localeData: LocaleData = {
      hash1: 'Bienvenido',
      removed1: 'Gone',
      removed2: 'Also gone',
    };
    const delta = computeDelta(manifest, defaultLocaleData, localeData);
    expect(delta.newHashes.sort()).toEqual(['hash2', 'hash3']);
    expect(delta.staleHashes.sort()).toEqual(['removed1', 'removed2']);
  });

  it('returns source content for new hashes', () => {
    const delta = computeDelta(manifest, defaultLocaleData, {});
    expect(delta.newEntries).toEqual([
      { hash: 'hash1', source: 'Welcome to our app', context: 'app/page.tsx:T@12', type: 'jsx' },
      { hash: 'hash2', source: 'Enter your email', context: 'app/page.tsx:useTranslation@8', type: 'string' },
      { hash: 'hash3', source: 'About us', context: 'app/about.tsx:T@5', type: 'jsx' },
    ]);
  });

  it('force mode treats all entries as new', () => {
    const localeData: LocaleData = {
      hash1: 'Existing',
      hash2: 'Existing',
      hash3: 'Existing',
    };
    const delta = computeDelta(manifest, defaultLocaleData, localeData, { force: true });
    expect(delta.newHashes).toEqual(['hash1', 'hash2', 'hash3']);
    expect(delta.staleHashes).toEqual([]);
  });
});
