import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHash } from 'crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StarlightProvider } from '../../src/docs/providers/starlight';

// Silence the TUI machinery so the test exercises the non-interactive branch.
mock.module('../../src/tui/run-tui', () => ({
  runTui: async <T>(
    build: (controls: { resolve(value: T | null): void; requestRender(force?: boolean): void }) => unknown,
  ) => {
    return await new Promise<T | null>((resolve) => {
      build({
        resolve,
        requestRender() {},
      });
    });
  },
}));

mock.module('../../src/tui/translate-activity', () => ({
  createTranslateActivityTui: () => ({
    root: {
      invalidate() {},
      render() {
        return [];
      },
    },
    setOverview() {},
    registerBatches() {},
    startBatch() {},
    recordRetry() {},
    recordSessionEvent() {},
    finishBatch() {},
    finish() {},
    snapshot() {
      return {
        title: '',
        overview: [],
        totals: { total: 0, queued: 0, running: 0, success: 0, failure: 0 },
        batches: [],
        recentEvents: [],
        elapsedMs: 0,
      };
    },
  }),
}));

const commandModulePromise = import('../../src/commands/translate-docs');

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures/docs-astro-project');
const SOURCE_RELATIVE_PATH = 'intro.astro';

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function getStateKey(workContentDir: string, relativePath: string, locale = 'es'): string {
  return `${workContentDir.replace(/\\/g, '/')}::${locale}::${relativePath.replace(/\\/g, '/')}`;
}

describe('translate-docs command — .astro support', () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  let workDir: string;
  let workContentDir: string;
  let sourcePath: string;
  let targetPath: string;
  let statePath: string;
  let sourceContent: string;

  beforeEach(() => {
    console.log = (() => {}) as typeof console.log;
    console.error = (() => {}) as typeof console.error;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    workDir = mkdtempSync(join(tmpdir(), 'tyndale-docs-astro-'));
    cpSync(FIXTURE_ROOT, workDir, { recursive: true });
    workContentDir = join(workDir, 'src/content/docs');
    sourcePath = join(workContentDir, SOURCE_RELATIVE_PATH);
    targetPath = join(workContentDir, 'es', SOURCE_RELATIVE_PATH);
    statePath = join(workDir, '.tyndale-docs-state.json');
    sourceContent = readFileSync(sourcePath, 'utf-8');
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    if (originalIsTTY) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTY);
    }
    rmSync(workDir, { recursive: true, force: true });
  });

  it('translates a .astro Starlight page, writes the target, and records state on the first try', async () => {
    const { handleTranslateDocs } = await commandModulePromise;

    const validTranslation = `---
import Layout from '../../layouts/Main.astro';
import Card from '../../components/Card.astro';

const title = 'Bienvenido';
---
<Layout title={title}>
  <h1>Bienvenido a Tyndale</h1>
  <Card client:load title="Resumen">
    <p>Traduce documentación <strong>con confianza</strong>.</p>
  </Card>
  <img src="/logo.png" alt="Logotipo de Tyndale" />
</Layout>
`;

    let sessionCalls = 0;
    const promptsSeen: string[] = [];

    const code = await handleTranslateDocs(
      {
        createSession: async () => ({
          async sendPrompt(prompt: string) {
            sessionCalls += 1;
            promptsSeen.push(prompt);
            return validTranslation;
          },
        }),
      },
      {
        contentDir: workContentDir,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx', '.md', '.astro'],
        provider: new StarlightProvider(),
        cwd: workDir,
      },
      { log() {}, error() {} },
    );

    expect(code).toBe(0);
    expect(sessionCalls).toBe(1);
    expect(existsSync(targetPath)).toBe(true);
    expect(readFileSync(targetPath, 'utf-8')).toBe(validTranslation);
    // Prompt used the .astro-specific body.
    expect(promptsSeen[0]).toContain('Astro page');
    expect(promptsSeen[0]).toContain('client:');

    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(state).toEqual({
      version: 1,
      entries: {
        [getStateKey(workContentDir, SOURCE_RELATIVE_PATH)]: computeHash(sourceContent),
      },
    });
  });

  it('retries a broken .astro translation via the correction prompt and writes the corrected output', async () => {
    const { handleTranslateDocs } = await commandModulePromise;

    // First response: missing the `Card` import line — fails Rule 2 of validator.
    const brokenTranslation = `---
import Layout from '../../layouts/Main.astro';

const title = 'Bienvenido';
---
<Layout title={title}>
  <h1>Bienvenido a Tyndale</h1>
  <Card client:load title="Resumen">
    <p>Traduce documentación <strong>con confianza</strong>.</p>
  </Card>
  <img src="/logo.png" alt="Logotipo de Tyndale" />
</Layout>
`;

    // Second response: valid.
    const fixedTranslation = `---
import Layout from '../../layouts/Main.astro';
import Card from '../../components/Card.astro';

const title = 'Bienvenido';
---
<Layout title={title}>
  <h1>Bienvenido a Tyndale</h1>
  <Card client:load title="Resumen">
    <p>Traduce documentación <strong>con confianza</strong>.</p>
  </Card>
  <img src="/logo.png" alt="Logotipo de Tyndale" />
</Layout>
`;

    let sessionCalls = 0;
    const promptsSeen: string[] = [];

    const code = await handleTranslateDocs(
      {
        createSession: async () => ({
          async sendPrompt(prompt: string) {
            sessionCalls += 1;
            promptsSeen.push(prompt);
            return sessionCalls === 1 ? brokenTranslation : fixedTranslation;
          },
        }),
      },
      {
        contentDir: workContentDir,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx', '.md', '.astro'],
        provider: new StarlightProvider(),
        cwd: workDir,
      },
      { log() {}, error() {} },
    );

    expect(code).toBe(0);
    expect(sessionCalls).toBe(2);
    // First prompt is the translation prompt; second is the correction prompt.
    expect(promptsSeen[0]).toContain('Astro page');
    expect(promptsSeen[1].toLowerCase()).toContain('validation error');
    expect(promptsSeen[1]).toContain('Missing import statement:');
    expect(readFileSync(targetPath, 'utf-8')).toBe(fixedTranslation);

    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    expect(state.entries[getStateKey(workContentDir, SOURCE_RELATIVE_PATH)]).toBe(
      computeHash(sourceContent),
    );
  });
});
