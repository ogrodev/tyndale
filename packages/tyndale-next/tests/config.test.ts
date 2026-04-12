// packages/tyndale-next/tests/config.test.ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { withTyndaleConfig } from '../src/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('withTyndaleConfig', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tyndale-config-'));
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

  test('throws if tyndale.config.json is missing', () => {
    expect(() => withTyndaleConfig({})).toThrow('tyndale.config.json');
  });

  test('returns a valid next config object', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  test('preserves existing next config properties', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({
      reactStrictMode: true,
      poweredByHeader: false,
    });
    expect(result.reactStrictMode).toBe(true);
    expect(result.poweredByHeader).toBe(false);
  });

  test('sets TYNDALE_DEFAULT_LOCALE env variable', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    expect(result.env?.TYNDALE_DEFAULT_LOCALE).toBe('en');
  });

  test('sets TYNDALE_LOCALES env variable as JSON', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    expect(result.env?.TYNDALE_LOCALES).toBe('["es","fr"]');
  });

  test('sets TYNDALE_COOKIE_NAME env variable', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    expect(result.env?.TYNDALE_COOKIE_NAME).toBe('TYNDALE_LOCALE');
  });

  test('sets TYNDALE_LOCALE_ALIASES env variable', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es', 'pt'],
      output: 'public/_tyndale',
      localeAliases: { 'pt-BR': 'pt', 'en-US': 'en' },
    });
    const result = withTyndaleConfig({});
    expect(result.env?.TYNDALE_LOCALE_ALIASES).toBe(
      JSON.stringify({ 'pt-BR': 'pt', 'en-US': 'en' }),
    );
  });

  test('sets TYNDALE_OUTPUT env variable', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    expect(result.env?.TYNDALE_OUTPUT).toBe('public/_tyndale');
  });

  test('merges env with existing env variables', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({
      env: { MY_VAR: 'hello' },
    });
    expect(result.env?.MY_VAR).toBe('hello');
    expect(result.env?.TYNDALE_DEFAULT_LOCALE).toBe('en');
  });

  test('throws with descriptive message for malformed config', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'tyndale.config.json'),
      'not valid json{{{',
    );
    expect(() => withTyndaleConfig({})).toThrow('tyndale.config.json');
  });

  test('returns a config with a webpack function', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    expect(typeof result.webpack).toBe('function');
  });

  test('webpack function sets resolve.alias for tyndale-react', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    const result = withTyndaleConfig({});
    const mockConfig = { resolve: { alias: {} as Record<string, string> } };
    const output = (result.webpack as Function)(mockConfig, {});
    expect(output.resolve.alias['tyndale-react']).toBeDefined();
    expect(typeof output.resolve.alias['tyndale-react']).toBe('string');
    expect(output.resolve.alias['tyndale-react']).toContain('tyndale-react');
  });

  test('webpack function chains with existing webpack', () => {
    writeConfig({
      defaultLocale: 'en',
      locales: ['es'],
      output: 'public/_tyndale',
      localeAliases: {},
    });
    let userWebpackCalled = false;
    const result = withTyndaleConfig({
      webpack: (config: any, _options: any) => {
        userWebpackCalled = true;
        config.resolve.alias['custom'] = '/custom/path';
        return config;
      },
    });
    const mockConfig = { resolve: { alias: {} as Record<string, string> } };
    const output = (result.webpack as Function)(mockConfig, {});
    expect(userWebpackCalled).toBe(true);
    expect(output.resolve.alias['custom']).toBe('/custom/path');
    expect(output.resolve.alias['tyndale-react']).toBeDefined();
  });

});
