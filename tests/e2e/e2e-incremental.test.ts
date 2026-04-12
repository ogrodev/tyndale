// tests/e2e/e2e-incremental.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFile, writeFile, rm, cp, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * E2E: incremental translation — verifies the core dev loop:
 *   modify source → re-extract → translate only sends new entries.
 */

const FIXTURE_DIR = join(__dirname, 'fixture');
const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

/** Spawn CLI, return { exitCode, stdout, stderr }. */
async function run(
  cmd: string[],
  opts: { cwd: string; env?: Record<string, string> },
) {
  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...cmd], {
    cwd: opts.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...opts.env },
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

async function readJSON<T = any>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

describe('E2E: incremental translation', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-incr-'));
    await cp(FIXTURE_DIR, workDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('full incremental cycle: extract → translate → add source → re-extract → re-translate preserves old entries', async () => {
    const outputDir = join(workDir, 'public/_tyndale');
    const mockEnv = { TYNDALE_MOCK_TRANSLATE: '1' };

    // ── Step 1: initial extract ─────────────────────────────────
    const extract1 = await run(['extract'], { cwd: workDir });
    expect(extract1.exitCode).toBe(0);

    const manifest1 = await readJSON<any>(join(outputDir, 'manifest.json'));
    const initialEntryCount = Object.keys(manifest1.entries).length;
    expect(initialEntryCount).toBeGreaterThan(0);

    // ── Step 2: initial translate (mock) ────────────────────────
    const translate1 = await run(['translate'], { cwd: workDir, env: mockEnv });
    expect(translate1.exitCode).toBe(0);

    const es1 = await readJSON<Record<string, string>>(join(outputDir, 'es.json'));
    const en1 = await readJSON<Record<string, string>>(join(outputDir, 'en.json'));
    expect(Object.keys(es1).length).toBe(initialEntryCount);

    // Every mock translation is "[es] " + source
    for (const [hash, value] of Object.entries(es1)) {
      expect(value).toStartWith('[es] ');
      expect(value.slice(5)).toBe(en1[hash]);
    }

    // Snapshot es.json content for later comparison
    const esSnapshot = { ...es1 };
    const esRaw1 = await readFile(join(outputDir, 'es.json'), 'utf-8');

    // ── Step 3: re-translate is a no-op ─────────────────────────
    const translate2 = await run(['translate'], { cwd: workDir, env: mockEnv });
    expect(translate2.exitCode).toBe(0);

    const esRaw2 = await readFile(join(outputDir, 'es.json'), 'utf-8');
    expect(esRaw2).toBe(esRaw1); // byte-identical — nothing changed

    // ── Step 4: add a new source file with new translatable strings ──
    const newComponentDir = join(workDir, 'app/[locale]/settings');
    await mkdir(newComponentDir, { recursive: true });
    await writeFile(
      join(newComponentDir, 'page.tsx'),
      `'use client';

import { T, useTranslation } from 'tyndale-react';

export default function SettingsPage() {
  const t = useTranslation();
  return (
    <div>
      <T><h2>Account Settings</h2></T>
      <button>{t('Save changes')}</button>
    </div>
  );
}
`,
    );

    // ── Step 5: re-extract — should have more entries ───────────
    const extract2 = await run(['extract'], { cwd: workDir });
    expect(extract2.exitCode).toBe(0);

    const manifest2 = await readJSON<any>(join(outputDir, 'manifest.json'));
    const newEntryCount = Object.keys(manifest2.entries).length;
    expect(newEntryCount).toBeGreaterThan(initialEntryCount);

    // ── Step 6: re-translate — adds new, preserves old ──────────
    const translate3 = await run(['translate'], { cwd: workDir, env: mockEnv });
    expect(translate3.exitCode).toBe(0);

    const es3 = await readJSON<Record<string, string>>(join(outputDir, 'es.json'));
    expect(Object.keys(es3).length).toBe(newEntryCount);

    // Old translations preserved verbatim
    for (const [hash, value] of Object.entries(esSnapshot)) {
      expect(es3[hash]).toBe(value);
    }

    // New entries exist and are mock-translated
    const en3 = await readJSON<Record<string, string>>(join(outputDir, 'en.json'));
    const newHashes = Object.keys(manifest2.entries).filter(
      (h) => !manifest1.entries[h],
    );
    expect(newHashes.length).toBeGreaterThan(0);
    for (const hash of newHashes) {
      expect(es3[hash]).toStartWith('[es] ');
      expect(es3[hash].slice(5)).toBe(en3[hash]);
    }
  });
});
