// packages/tyndale/tests/commands/translate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { handleTranslate, type TranslateOptions, type TranslateDeps } from '../../src/commands/translate';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Manifest } from '../../src/translate/delta';
import type { TranslationSession } from '../../src/translate/batch-translator';

const TEST_DIR = join(import.meta.dir, '__fixtures__/translate-cmd');
const OUTPUT_DIR = join(TEST_DIR, 'public/_tyndale');

function writeJSON(path: string, data: unknown) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function readJSON(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('translate command', () => {
  let output: string[];
  let logger: { log: (m: string) => void; error: (m: string) => void };

  beforeEach(() => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    output = [];
    logger = {
      log: (msg: string) => output.push(msg),
      error: (msg: string) => output.push(`ERROR: ${msg}`),
    };
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  function createManifest(entries: Manifest['entries']): Manifest {
    return {
      version: 1,
      defaultLocale: 'en',
      locales: ['es'],
      entries,
    };
  }

  function createMockSession(translations: Record<string, string>): TranslationSession {
    return {
      async sendPrompt(_prompt: string) {
        return { translations };
      },
    };
  }

  it('translates new entries and writes locale file', async () => {
    const manifest = createManifest({
      h1: { type: 'string', context: 'a.tsx:T@1' },
      h2: { type: 'string', context: 'b.tsx:T@2' },
    });
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello', h2: 'World' });

    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => createMockSession({ h1: 'Hola', h2: 'Mundo' }),
    };

    const code = await handleTranslate(deps, {}, logger);
    expect(code).toBe(0);

    const esData = readJSON(join(OUTPUT_DIR, 'es.json'));
    expect(esData).toEqual({ h1: 'Hola', h2: 'Mundo' });
  });

  it('removes stale entries from locale file', async () => {
    const manifest = createManifest({
      h1: { type: 'string', context: 'a.tsx:T@1' },
    });
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello' });
    writeJSON(join(OUTPUT_DIR, 'es.json'), { h1: 'Hola', old: 'Viejo' });

    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => createMockSession({}),
    };

    const code = await handleTranslate(deps, {}, logger);
    expect(code).toBe(0);

    const esData = readJSON(join(OUTPUT_DIR, 'es.json')) as Record<string, string>;
    expect(esData).toEqual({ h1: 'Hola' });
    expect(esData).not.toHaveProperty('old');
  });

  it('skips translation in dry-run mode', async () => {
    const manifest = createManifest({
      h1: { type: 'string', context: 'a.tsx:T@1' },
    });
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello' });

    let sessionCreated = false;
    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => {
        sessionCreated = true;
        return createMockSession({});
      },
    };

    const code = await handleTranslate(deps, { dryRun: true }, logger);
    expect(code).toBe(0);
    expect(sessionCreated).toBe(false);
    expect(output.some((l) => l.includes('new'))).toBe(true);
  });

  it('filters to single locale with --locale flag', async () => {
    const manifest: Manifest = {
      version: 1,
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      entries: {
        h1: { type: 'string', context: 'a.tsx:T@1' },
      },
    };
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello' });

    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => createMockSession({ h1: 'Hola' }),
    };

    const code = await handleTranslate(deps, { locale: 'es' }, logger);
    expect(code).toBe(0);

    const esData = readJSON(join(OUTPUT_DIR, 'es.json'));
    expect(esData).toEqual({ h1: 'Hola' });

    // fr.json should NOT be created
    const frPath = join(OUTPUT_DIR, 'fr.json');
    expect(() => readFileSync(frPath)).toThrow();
  });

  it('retranslates everything with --force', async () => {
    const manifest = createManifest({
      h1: { type: 'string', context: 'a.tsx:T@1' },
    });
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello' });
    writeJSON(join(OUTPUT_DIR, 'es.json'), { h1: 'Old Hola' });

    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => createMockSession({ h1: 'Nuevo Hola' }),
    };

    const code = await handleTranslate(deps, { force: true }, logger);
    expect(code).toBe(0);

    const esData = readJSON(join(OUTPUT_DIR, 'es.json')) as Record<string, string>;
    expect(esData.h1).toBe('Nuevo Hola');
  });

  it('exits 1 on partial failure but preserves successful locales', async () => {
    const manifest: Manifest = {
      version: 1,
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      entries: {
        h1: { type: 'string', context: 'a.tsx:T@1' },
      },
    };
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello' });

    let callCount = 0;
    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => ({
        async sendPrompt(_prompt: string) {
          callCount++;
          // es succeeds, fr fails
          if (_prompt.includes('Spanish')) {
            return { translations: { h1: 'Hola' } };
          }
          throw new Error('Network timeout');
        },
      }),
    };

    const code = await handleTranslate(deps, {}, logger);
    // Should exit 1 because fr failed
    expect(code).toBe(1);

    // But es.json should still be written
    const esData = readJSON(join(OUTPUT_DIR, 'es.json'));
    expect(esData).toEqual({ h1: 'Hola' });

    // Error should be reported
    expect(output.some((l) => l.includes('fr') || l.includes('failed'))).toBe(true);
  });

  it('reports nothing to do when no delta', async () => {
    const manifest = createManifest({
      h1: { type: 'string', context: 'a.tsx:T@1' },
    });
    writeJSON(join(OUTPUT_DIR, 'manifest.json'), manifest);
    writeJSON(join(OUTPUT_DIR, 'en.json'), { h1: 'Hello' });
    writeJSON(join(OUTPUT_DIR, 'es.json'), { h1: 'Hola' });

    const deps: TranslateDeps = {
      outputDir: OUTPUT_DIR,
      createSession: async () => createMockSession({}),
    };

    const code = await handleTranslate(deps, {}, logger);
    expect(code).toBe(0);
    expect(output.some((l) => l.includes('up to date') || l.includes('0 new'))).toBe(true);
  });
});
