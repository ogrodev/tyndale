// tests/e2e/e2e-force.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFile, writeFile, rm, cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * E2E: --force retranslation — verifies that `translate --force`
 * retranslates ALL entries from scratch, overwriting stale values.
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

describe('E2E: --force retranslation', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-force-'));
    await cp(FIXTURE_DIR, workDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('--force retranslates all entries even when unchanged', async () => {
    const outputDir = join(workDir, 'public/_tyndale');
    const mockEnv = { TYNDALE_MOCK_TRANSLATE: '1' };

    // ── Step 1: extract source strings ──────────────────────────
    const extract = await run(['extract'], { cwd: workDir });
    expect(extract.exitCode).toBe(0);

    // ── Step 2: initial translate (mock) ────────────────────────
    const translate1 = await run(['translate'], { cwd: workDir, env: mockEnv });
    expect(translate1.exitCode).toBe(0);

    const es1 = await readJSON<Record<string, string>>(join(outputDir, 'es.json'));
    const en = await readJSON<Record<string, string>>(join(outputDir, 'en.json'));
    const hashes = Object.keys(es1);
    expect(hashes.length).toBeGreaterThan(0);

    // Sanity: every value should be mock-translated
    for (const [hash, value] of Object.entries(es1)) {
      expect(value).toStartWith('[es] ');
    }

    // ── Step 3: tamper with one entry to simulate stale data ────
    const tamperedHash = hashes[0];
    const originalValue = es1[tamperedHash];
    const tampered = { ...es1, [tamperedHash]: 'TAMPERED' };
    await writeFile(join(outputDir, 'es.json'), JSON.stringify(tampered, null, 2));

    // Confirm tamper took effect
    const esCheck = await readJSON<Record<string, string>>(join(outputDir, 'es.json'));
    expect(esCheck[tamperedHash]).toBe('TAMPERED');

    // ── Step 4: translate --force overwrites everything ─────────
    const translate2 = await run(['translate', '--force'], { cwd: workDir, env: mockEnv });
    expect(translate2.exitCode).toBe(0);

    const es2 = await readJSON<Record<string, string>>(join(outputDir, 'es.json'));

    // Tampered value was overwritten back to a mock translation
    expect(es2[tamperedHash]).not.toBe('TAMPERED');
    expect(es2[tamperedHash]).toStartWith('[es] ');
    expect(es2[tamperedHash]).toBe(originalValue);

    // ALL entries were retranslated (every value starts with "[es] ")
    for (const [hash, value] of Object.entries(es2)) {
      expect(value).toStartWith('[es] ');
      // Mock translation is "[es] " + source english value
      expect(value.slice(5)).toBe(en[hash]);
    }

    // Key sets match exactly — no stale entries, no missing entries
    const enKeys = Object.keys(en).sort();
    const esKeys = Object.keys(es2).sort();
    expect(esKeys).toEqual(enKeys);
    expect(esKeys.length).toBe(hashes.length);
  });
});
