import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { loadConfig, ConfigError } from '../src/config.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(import.meta.dir, '__fixtures__');

function createFixture(name: string, content: string): string {
  const dir = join(FIXTURES_DIR, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tyndale.config.json'), content);
  return dir;
}

beforeEach(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('loads a valid config file', () => {
    const dir = createFixture('valid', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es', 'fr'],
    }));

    const config = loadConfig(dir);
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['es', 'fr']);
  });

  it('accepts optional fields', () => {
    const dir = createFixture('full', JSON.stringify({
      defaultLocale: 'en',
      locales: ['ja'],
      include: ['src', 'app'],
      exclude: ['**/*.test.ts'],
      extensions: ['.tsx'],
      dictionaries: { include: ['src/dictionaries/*.json'] },
    }));

    const config = loadConfig(dir);
    expect(config.include).toEqual(['src', 'app']);
    expect(config.exclude).toEqual(['**/*.test.ts']);
    expect(config.extensions).toEqual(['.tsx']);
    expect(config.dictionaries?.include).toEqual(['src/dictionaries/*.json']);
  });

  it('throws ConfigError when config file is missing', () => {
    const dir = join(FIXTURES_DIR, 'missing');
    mkdirSync(dir, { recursive: true });

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/tyndale\.config\.json/);
  });

  it('throws ConfigError when config is malformed JSON', () => {
    const dir = createFixture('malformed', '{ invalid json!!!');

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/parse/i);
  });

  it('throws ConfigError when defaultLocale is missing', () => {
    const dir = createFixture('no-default', JSON.stringify({
      locales: ['es'],
    }));

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/defaultLocale/);
  });

  it('throws ConfigError when locales is missing', () => {
    const dir = createFixture('no-locales', JSON.stringify({
      defaultLocale: 'en',
    }));

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/locales/);
  });

  it('throws ConfigError when locales is empty', () => {
    const dir = createFixture('empty-locales', JSON.stringify({
      defaultLocale: 'en',
      locales: [],
    }));

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/locales/);
  });

  it('throws ConfigError when defaultLocale is not a string', () => {
    const dir = createFixture('bad-default', JSON.stringify({
      defaultLocale: 42,
      locales: ['es'],
    }));

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/defaultLocale/);
  });

  it('throws ConfigError when locales contains non-strings', () => {
    const dir = createFixture('bad-locale-entry', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es', 42],
    }));

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/locales/);
  });

  it('throws ConfigError when defaultLocale appears in locales', () => {
    const dir = createFixture('dup-default', JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'es'],
    }));

    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/defaultLocale.*must not appear in.*locales/i);
  });

  it('accepts new spec fields: source, output, translate, localeAliases, pi, dictionaries.format', () => {
    const dir = createFixture('full-spec', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      source: ['src', 'app'],
      output: 'dist/i18n',
      translate: { tokenBudget: 30000, concurrency: 4 },
      localeAliases: { pt: 'pt-BR' },
      pi: { model: 'claude-4', thinkingLevel: 'high' },
      dictionaries: { include: ['dict/*.json'], format: 'nested' },
    }));

    const config = loadConfig(dir);
    expect(config.source).toEqual(['src', 'app']);
    expect(config.output).toBe('dist/i18n');
    expect(config.translate).toEqual({ tokenBudget: 30000, concurrency: 4 });
    expect(config.localeAliases).toEqual({ pt: 'pt-BR' });
    expect(config.pi).toEqual({ model: 'claude-4', thinkingLevel: 'high' });
    expect(config.dictionaries?.format).toBe('nested');
  });

  it('throws when source is not an array of strings', () => {
    const dir = createFixture('bad-source', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      source: 'src',
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/source/);
  });

  it('throws when output is not a string', () => {
    const dir = createFixture('bad-output', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      output: ['dist'],
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/output/);
  });

  it('throws when translate.tokenBudget is not a positive integer', () => {
    const dir = createFixture('bad-token-budget', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      translate: { tokenBudget: -1 },
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/translate\.tokenBudget/);
  });

  it('throws when translate.concurrency is not a positive integer', () => {
    const dir = createFixture('bad-concurrency', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      translate: { concurrency: 0 },
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/translate\.concurrency/);
  });

  it('throws when translate is not an object', () => {
    const dir = createFixture('bad-translate', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      translate: 'fast',
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/translate/);
  });

  it('throws when localeAliases values are not strings', () => {
    const dir = createFixture('bad-aliases', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      localeAliases: { pt: 42 },
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/localeAliases/);
  });

  it('throws when pi.model is not a string', () => {
    const dir = createFixture('bad-pi', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      pi: { model: 123 },
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/pi\.model/);
  });

  it('throws when dictionaries.format is not a string', () => {
    const dir = createFixture('bad-dict-format', JSON.stringify({
      defaultLocale: 'en',
      locales: ['es'],
      dictionaries: { include: ['*.json'], format: 42 },
    }));
    expect(() => loadConfig(dir)).toThrow(ConfigError);
    expect(() => loadConfig(dir)).toThrow(/dictionaries\.format/);
  });

  it('defaults cwd to process.cwd()', () => {
    // This test just ensures the function signature works without args.
    // It will throw because there's no config in the test runner's cwd.
    expect(() => loadConfig()).toThrow(ConfigError);
  });
});
