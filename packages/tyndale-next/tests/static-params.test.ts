// packages/tyndale-next/tests/static-params.test.ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { generateStaticLocaleParams } from '../src/static-params';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('generateStaticLocaleParams', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tyndale-ssg-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(config: object) {
    fs.writeFileSync(
      path.join(tmpDir, 'tyndale.config.json'),
      JSON.stringify(config),
    );
  }

  test('returns default locale plus all target locales', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es', 'fr', 'ja'],
    });
    const params = generateStaticLocaleParams();
    expect(params).toEqual([
      { locale: 'en' },
      { locale: 'es' },
      { locale: 'fr' },
      { locale: 'ja' },
    ]);
  });

  test('returns only default locale when no target locales', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: [],
    });
    const params = generateStaticLocaleParams();
    expect(params).toEqual([{ locale: 'en' }]);
  });

  test('default locale is always first in the array', () => {
    writeConfig({
      defaultLocale: 'pt',
      locales: ['en', 'es'],
    });
    const params = generateStaticLocaleParams();
    expect(params[0]).toEqual({ locale: 'pt' });
    expect(params).toHaveLength(3);
  });

  test('throws if config file is missing', () => {
    expect(() => generateStaticLocaleParams()).toThrow('tyndale.config.json');
  });
});
