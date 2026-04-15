import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { CreateTranslationSessionOptions } from '../../src/translate/pi-session';
import type { TranslationSession } from '../../src/translate/batch-translator';

const TEST_DIR = join(import.meta.dir, '__fixtures__/translate-docs-cmd');
const CONTENT_DIR = join(TEST_DIR, 'src/content/docs');
const SOURCE_DOC_PATH = join(CONTENT_DIR, 'getting-started.mdx');
const TARGET_DOC_PATH = join(CONTENT_DIR, 'es/getting-started.mdx');
const STATE_PATH = join(TEST_DIR, '.tyndale-docs-state.json');
const SOURCE_RELATIVE_PATH = 'getting-started.mdx';

const SOURCE_DOC = `---
title: Getting started
description: "Install the CLI"
---
import { Card } from '../../components/Card';

# Welcome

<Card title="Quickstart" />
`;

const INVALID_TRANSLATION = `# [es] Bienvenido`;

const CORRECTED_TRANSLATION = `---
title: "[es] Primeros pasos"
description: "[es] Instala el CLI"
---
import { Card } from '../../components/Card';

# [es] Bienvenido

<Card title="[es] Quickstart" />
`;

type FakeActivityController = {
  options: Record<string, unknown> | undefined;
  overviews: unknown[];
  registered: unknown[];
  started: string[];
  events: Array<{ batchId: string; event: unknown }>;
  finishedBatches: Array<{ batchId: string; ok: boolean; detail?: string }>;
  footers: Array<string | undefined>;
};

const runTuiOptions: Array<Record<string, unknown> | undefined> = [];
const activityControllers: FakeActivityController[] = [];

mock.module('../../src/tui/run-tui', () => ({
  runTui: async <T>(
    build: (controls: { resolve(value: T | null): void; requestRender(force?: boolean): void }) => unknown,
    options?: Record<string, unknown>,
  ) => {
    runTuiOptions.push(options);

    return await new Promise<T | null>((resolve) => {
      build({
        resolve,
        requestRender() {},
      });
    });
  },
}));

mock.module('../../src/tui/translate-activity', () => ({
  createTranslateActivityTui: (_controls: unknown, options?: Record<string, unknown>) => {
    const controller: FakeActivityController = {
      options,
      overviews: [],
      registered: [],
      started: [],
      events: [],
      finishedBatches: [],
      footers: [],
    };
    activityControllers.push(controller);

    return {
      root: {
        invalidate() {},
        render() {
          return [];
        },
      },
      setOverview(rows: unknown) {
        controller.overviews.push(rows);
      },
      registerBatches(batches: unknown) {
        controller.registered.push(batches);
      },
      startBatch(batchId: string) {
        controller.started.push(batchId);
      },
      recordRetry() {},
      recordSessionEvent(batchId: string, event: unknown) {
        controller.events.push({ batchId, event });
      },
      finishBatch(batchId: string, ok: boolean, detail?: string) {
        controller.finishedBatches.push({ batchId, ok, detail });
      },
      finish(footer?: string) {
        controller.footers.push(footer);
      },
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
    };
  },
}));

const commandModulePromise = import('../../src/commands/translate-docs');

function writeDoc(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function getStateKey(relativePath: string, locale: string = 'es'): string {
  return `${CONTENT_DIR.replace(/\\/g, '/')}::${locale}::${relativePath.replace(/\\/g, '/')}`;
}

function writeDocsState(entries: Record<string, string>): void {
  writeFileSync(STATE_PATH, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`);
}

describe('translate-docs command', () => {
  const originalLog = console.log;
  const originalError = console.error;
  const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');

  beforeEach(() => {
    runTuiOptions.length = 0;
    activityControllers.length = 0;
    console.log = (() => {}) as typeof console.log;
    console.error = (() => {}) as typeof console.error;
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    writeDoc(SOURCE_DOC_PATH, SOURCE_DOC);
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    if (originalIsTTY) {
      Object.defineProperty(process.stdout, 'isTTY', originalIsTTY);
    }
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('retries invalid translations and writes corrected docs in non-interactive mode', async () => {
    const output: string[] = [];
    let sessionCalls = 0;
    const { handleTranslateDocs } = await commandModulePromise;

    const logger = {
      log: (message: string) => output.push(message),
      error: (message: string) => output.push(`ERROR: ${message}`),
    };

    const code = await handleTranslateDocs(
      {
        createSession: async () => ({
          async sendPrompt() {
            sessionCalls += 1;
            return sessionCalls === 1 ? INVALID_TRANSLATION : CORRECTED_TRANSLATION;
          },
        }),
      },
      {
        contentDir: CONTENT_DIR,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx'],
        cwd: TEST_DIR,
      },
      logger,
    );

    expect(code).toBe(0);
    expect(sessionCalls).toBe(2);
    expect(readFileSync(TARGET_DOC_PATH, 'utf-8')).toBe(CORRECTED_TRANSLATION);
    expect(output.some((line) => line.includes('es/getting-started.mdx corrected'))).toBe(true);
  });

  it('uses live activity TUI for translate and correction phases in interactive mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

    const capturedSessionOptions: Array<CreateTranslationSessionOptions | undefined> = [];
    let sessionCalls = 0;
    const { handleTranslateDocs } = await commandModulePromise;

    const code = await handleTranslateDocs(
      {
        createSession: async (sessionOptions?: CreateTranslationSessionOptions): Promise<TranslationSession> => {
          capturedSessionOptions.push(sessionOptions);
          return {
            async sendPrompt() {
              sessionCalls += 1;
              sessionOptions?.onActivity?.({
                type: 'text_delta',
                delta: sessionCalls === 1 ? '[es] Bien' : '[es] Cor',
                text: sessionCalls === 1 ? '[es] Bienvenido' : '[es] Corregido',
              });
              return sessionCalls === 1 ? INVALID_TRANSLATION : CORRECTED_TRANSLATION;
            },
          };
        },
      },
      {
        contentDir: CONTENT_DIR,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx'],
        cwd: TEST_DIR,
      },
      console,
    );

    expect(code).toBe(0);
    expect(runTuiOptions).toEqual([
      { clearOnExit: true, rethrowSignals: true, renderIntervalMs: 1_000 },
      { clearOnExit: true, rethrowSignals: true, renderIntervalMs: 1_000 },
    ]);
    expect(capturedSessionOptions).toHaveLength(2);
    expect(capturedSessionOptions.every((options) => typeof options?.onActivity === 'function')).toBe(true);
    expect(activityControllers).toHaveLength(2);
    expect(activityControllers[0].options).toMatchObject({
      title: 'LIVE DOCS TRANSLATION',
      activitySectionTitle: 'Document activity',
    });
    expect(activityControllers[1].options).toMatchObject({
      title: 'LIVE DOC CORRECTION',
      activitySectionTitle: 'Correction activity',
    });
    expect(activityControllers[0].overviews[0]).toEqual([
      { label: 'source docs', value: 1 },
      { label: 'locales active', value: 1 },
      { label: 'concurrency', value: '10 (auto-detected)' },
    ]);
    expect(activityControllers[1].overviews[0]).toEqual([
      { label: 'affected locales', value: 1 },
      { label: 'concurrency', value: '10 (auto-detected)' },
    ]);
    expect(activityControllers[0].registered[0]).toEqual([
      {
        id: 'es/getting-started.mdx',
        label: 'es/getting-started.mdx',
        locale: 'es',
        batchIndex: 0,
      },
    ]);
    expect(activityControllers[0].events).toEqual([
      {
        batchId: 'es/getting-started.mdx',
        event: { type: 'text_delta', delta: '[es] Bien', text: '[es] Bienvenido' },
      },
    ]);
    expect(activityControllers[1].events).toEqual([
      {
        batchId: 'es/getting-started.mdx',
        event: { type: 'text_delta', delta: '[es] Cor', text: '[es] Corregido' },
      },
    ]);
    expect(readFileSync(TARGET_DOC_PATH, 'utf-8')).toBe(CORRECTED_TRANSLATION);
  });

  it('writes docs state after a successful translation', async () => {
    let sessionCalls = 0;
    const { handleTranslateDocs } = await commandModulePromise;

    const code = await handleTranslateDocs(
      {
        createSession: async () => ({
          async sendPrompt() {
            sessionCalls += 1;
            return CORRECTED_TRANSLATION;
          },
        }),
      },
      {
        contentDir: CONTENT_DIR,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx'],
        cwd: TEST_DIR,
      },
      console,
    );

    expect(code).toBe(0);
    expect(sessionCalls).toBe(1);
    expect(JSON.parse(readFileSync(STATE_PATH, 'utf-8'))).toEqual({
      version: 1,
      entries: {
        [getStateKey(SOURCE_RELATIVE_PATH)]: computeHash(SOURCE_DOC),
      },
    });
  });

  it('skips docs when the persisted source hash matches, even if the source file is newer', async () => {
    writeDoc(TARGET_DOC_PATH, CORRECTED_TRANSLATION);
    writeDocsState({ [getStateKey(SOURCE_RELATIVE_PATH)]: computeHash(SOURCE_DOC) });
    writeDoc(SOURCE_DOC_PATH, SOURCE_DOC);

    let sessionCalls = 0;
    const { handleTranslateDocs } = await commandModulePromise;

    const code = await handleTranslateDocs(
      {
        createSession: async () => ({
          async sendPrompt() {
            sessionCalls += 1;
            return CORRECTED_TRANSLATION;
          },
        }),
      },
      {
        contentDir: CONTENT_DIR,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx'],
        cwd: TEST_DIR,
      },
      console,
    );

    expect(code).toBe(0);
    expect(sessionCalls).toBe(0);
  });

  it('retranslates docs when the persisted source hash differs, even if the translation file is newer', async () => {
    writeDoc(TARGET_DOC_PATH, CORRECTED_TRANSLATION);
    writeDocsState({ [getStateKey(SOURCE_RELATIVE_PATH)]: computeHash(SOURCE_DOC.replace('Quickstart', 'Old quickstart')) });

    let sessionCalls = 0;
    const { handleTranslateDocs } = await commandModulePromise;

    const code = await handleTranslateDocs(
      {
        createSession: async () => ({
          async sendPrompt() {
            sessionCalls += 1;
            return CORRECTED_TRANSLATION;
          },
        }),
      },
      {
        contentDir: CONTENT_DIR,
        locales: ['es'],
        defaultLocale: 'en',
        extensions: ['.mdx'],
        cwd: TEST_DIR,
      },
      console,
    );

    expect(code).toBe(0);
    expect(sessionCalls).toBe(1);
    expect(JSON.parse(readFileSync(STATE_PATH, 'utf-8'))).toEqual({
      version: 1,
      entries: {
        [getStateKey(SOURCE_RELATIVE_PATH)]: computeHash(SOURCE_DOC),
      },
    });
  });
});
