// packages/tyndale-react/tests/get-translation.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getTranslation } from '../src/get-translation';
import { hash } from '../src/hash';

describe('getTranslation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tyndale-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('returns t() that translates a string', async () => {
    const source = 'Hello';
    const h = hash(source);
    const localeData = { [h]: 'Hola' };
    await writeFile(
      join(tempDir, 'es.json'),
      JSON.stringify(localeData),
    );

    const t = await getTranslation({
      locale: 'es',
      outputPath: tempDir,
    });
    expect(t(source)).toBe('Hola');
  });

  test('falls back to source when translation missing', async () => {
    await writeFile(join(tempDir, 'es.json'), JSON.stringify({}));

    const t = await getTranslation({
      locale: 'es',
      outputPath: tempDir,
    });
    expect(t('Untranslated')).toBe('Untranslated');
  });

  test('supports interpolation', async () => {
    const source = 'Hello, {name}!';
    const h = hash(source);
    await writeFile(
      join(tempDir, 'es.json'),
      JSON.stringify({ [h]: '¡Hola, {name}!' }),
    );

    const t = await getTranslation({
      locale: 'es',
      outputPath: tempDir,
    });
    expect(t(source, { name: 'Pedro' })).toBe('¡Hola, Pedro!');
  });

  test('returns source-passthrough t() when locale file not found', async () => {
    const t = await getTranslation({
      locale: 'fr',
      outputPath: tempDir,
    });
    expect(t('Hello')).toBe('Hello');
  });

  test('returns source-passthrough t() for default locale (no file needed)', async () => {
    const t = await getTranslation({
      locale: 'en',
      defaultLocale: 'en',
      outputPath: tempDir,
    });
    // For default locale, source IS the translation
    expect(t('Hello')).toBe('Hello');
    expect(t('Hi, {name}!', { name: 'World' })).toBe('Hi, World!');
  });
});
