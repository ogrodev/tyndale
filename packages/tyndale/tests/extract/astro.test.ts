import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runExtract } from '../../src/commands/extract';

const FIXTURE_SRC = join(import.meta.dir, '../fixtures/astro-project');

describe('runExtract over a mixed .astro + .tsx project', () => {
  let workDir: string;
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    console.log = (() => {}) as typeof console.log;
    console.error = (() => {}) as typeof console.error;
    workDir = mkdtempSync(join(tmpdir(), 'tyndale-astro-extract-'));
    cpSync(FIXTURE_SRC, workDir, { recursive: true });
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    rmSync(workDir, { recursive: true, force: true });
  });

  it('scans both .astro and .tsx, dedupes, writes manifest, exits 0', async () => {
    const silentLogger = { log() {}, error() {} };
    const result = await runExtract({}, workDir, silentLogger);
    expect(result.exitCode).toBe(0);

    const outputDir = join(workDir, 'public/_tyndale');
    expect(existsSync(join(outputDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'en.json'))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf-8'));
    const localeData = JSON.parse(readFileSync(join(outputDir, 'en.json'), 'utf-8')) as Record<string, string>;

    // 2 T components (one per file) + 2 msg() calls (one per file) = 4 unique entries.
    const wires = Object.values(localeData).sort();
    expect(wires).toEqual([
      'Greeting from Astro',
      'Greeting from TSX',
      'Hello from Astro',
      'Hello from TSX',
    ]);

    const entries = Object.values(manifest.entries) as Array<{ type: string; context: string }>;
    const jsx = entries.filter((e) => e.type === 'jsx');
    const str = entries.filter((e) => e.type === 'string');
    expect(jsx).toHaveLength(2);
    expect(str).toHaveLength(2);

    const contexts = entries.map((e) => e.context);
    expect(contexts.some((c) => c.startsWith('src/page.astro:T@'))).toBe(true);
    expect(contexts.some((c) => c.startsWith('src/page.astro:msg@'))).toBe(true);
    expect(contexts.some((c) => c.startsWith('src/page.tsx:T@'))).toBe(true);
    expect(contexts.some((c) => c.startsWith('src/page.tsx:msg@'))).toBe(true);
  });
});
