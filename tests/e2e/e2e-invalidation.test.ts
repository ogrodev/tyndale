// tests/e2e/e2e-invalidation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFile, writeFile, rm, cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * E2E: content invalidation and stale translation cleanup.
 *
 * When a developer changes translatable text, the old hash disappears
 * from manifest and locale files, and a new hash takes its place.
 * Unchanged translations are preserved.
 *
 * When a source file is deleted, all its entries are removed from
 * manifest and locale files on the next extract+translate cycle.
 */

const FIXTURE_DIR = join(__dirname, 'fixture');
const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

function runCli(args: string[], cwd: string, env?: Record<string, string>) {
  return Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  });
}

async function readJson<T = Record<string, unknown>>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf-8')) as T;
}

interface Manifest {
  version: number;
  defaultLocale: string;
  locales: string[];
  entries: Record<string, { type: string; context: string }>;
}

describe('E2E: content invalidation cleans stale translations', () => {
  let workDir: string;
  const outDir = () => join(workDir, 'public/_tyndale');

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-invalidation-'));
    await cp(FIXTURE_DIR, workDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('content changes invalidate hashes, clean stale translations, and preserve unchanged entries', async () => {
    // ── Step 1: Extract baseline ────────────────────────────────────
    const extract1 = runCli(['extract'], workDir);
    expect(await extract1.exited).toBe(0);

    const initialManifest = await readJson<Manifest>(join(outDir(), 'manifest.json'));
    const initialEn = await readJson<Record<string, string>>(join(outDir(), 'en.json'));
    const initialHashes = new Set(Object.keys(initialManifest.entries));
    expect(initialHashes.size).toBeGreaterThan(0);

    // Identify the hash for the "Welcome to Tyndale" entry
    const welcomeEntry = Object.entries(initialEn).find(([, v]) =>
      v.includes('Welcome to Tyndale'),
    );
    expect(welcomeEntry).toBeDefined();
    const changedHash = welcomeEntry![0];
    expect(initialManifest.entries[changedHash]).toBeDefined();

    // ── Step 2: Translate baseline ──────────────────────────────────
    const translate1 = runCli(['translate'], workDir, { TYNDALE_MOCK_TRANSLATE: '1' });
    expect(await translate1.exited).toBe(0);

    const initialEs = await readJson<Record<string, string>>(join(outDir(), 'es.json'));
    expect(initialEs[changedHash]).toBeDefined();
    expect(initialEs[changedHash]).toStartWith('[es] ');

    // ── Step 3: Modify source text ──────────────────────────────────
    const pagePath = join(workDir, 'app/[locale]/page.tsx');
    const source = await readFile(pagePath, 'utf-8');
    expect(source).toContain('Welcome to Tyndale');
    const modified = source.replace('Welcome to Tyndale', 'Welcome to Tyndale v2');
    expect(modified).not.toBe(source); // sanity: replacement happened
    await writeFile(pagePath, modified, 'utf-8');

    // ── Step 4: Re-extract and verify hash rotation ─────────────────
    const extract2 = runCli(['extract'], workDir);
    expect(await extract2.exited).toBe(0);

    const newManifest = await readJson<Manifest>(join(outDir(), 'manifest.json'));
    const newEn = await readJson<Record<string, string>>(join(outDir(), 'en.json'));
    const newHashes = new Set(Object.keys(newManifest.entries));

    // Same total count: one removed, one added
    expect(newHashes.size).toBe(initialHashes.size);

    // Old hash for "Welcome to Tyndale" is gone
    expect(newHashes.has(changedHash)).toBe(false);
    expect(newEn[changedHash]).toBeUndefined();

    // New hash for "Welcome to Tyndale v2" exists
    const v2Entry = Object.entries(newEn).find(([, v]) =>
      v.includes('Welcome to Tyndale v2'),
    );
    expect(v2Entry).toBeDefined();
    const newHash = v2Entry![0];
    expect(newManifest.entries[newHash]).toBeDefined();

    // All other hashes are unchanged
    for (const h of initialHashes) {
      if (h === changedHash) continue;
      expect(newHashes.has(h)).toBe(true);
    }

    // ── Step 5: Translate after invalidation ────────────────────────
    const translate2 = runCli(['translate'], workDir, { TYNDALE_MOCK_TRANSLATE: '1' });
    expect(await translate2.exited).toBe(0);

    const newEs = await readJson<Record<string, string>>(join(outDir(), 'es.json'));

    // Old hash is NOT in es.json (stale entry removed)
    expect(newEs[changedHash]).toBeUndefined();

    // New hash IS in es.json with mock-translated content
    const v2EntryEs = Object.entries(newEn).find(([, v]) =>
      v.includes('Welcome to Tyndale v2'),
    );
    expect(v2EntryEs).toBeDefined();
    const newHashEs = v2EntryEs![0];
    expect(newEs[newHashEs]).toBeDefined();
    expect(newEs[newHashEs]).toStartWith('[es] ');
    expect(newEs[newHashEs]).toContain('Welcome to Tyndale v2');

    // es.json keys match en.json keys exactly
    expect(Object.keys(newEs).sort()).toEqual(Object.keys(newEn).sort());

    // All unchanged translations are preserved verbatim
    for (const [hash, value] of Object.entries(initialEs)) {
      if (hash === changedHash) continue;
      expect(newEs[hash]).toBe(value);
    }
  });

  describe('file deletion', () => {
    let deletionWorkDir: string;
    const deletionOutDir = () => join(deletionWorkDir, 'public/_tyndale');

    beforeAll(async () => {
      deletionWorkDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-invalidation-delete-'));
      await cp(FIXTURE_DIR, deletionWorkDir, { recursive: true });
    });

    afterAll(async () => {
      await rm(deletionWorkDir, { recursive: true, force: true });
    });

    it('deleting a source file removes all its entries from manifest and locale files', async () => {
      // ── Step 1: Extract + translate baseline ────────────────────────
      const extract1 = runCli(['extract'], deletionWorkDir);
      expect(await extract1.exited).toBe(0);

      const translate1 = runCli(['translate'], deletionWorkDir, { TYNDALE_MOCK_TRANSLATE: '1' });
      expect(await translate1.exited).toBe(0);

      const baselineManifest = await readJson<Manifest>(join(deletionOutDir(), 'manifest.json'));
      const baselineEn = await readJson<Record<string, string>>(join(deletionOutDir(), 'en.json'));
      const baselineEs = await readJson<Record<string, string>>(join(deletionOutDir(), 'es.json'));

      const baselineEntryCount = Object.keys(baselineManifest.entries).length;
      expect(baselineEntryCount).toBeGreaterThan(0);

      // Sanity: baseline es.json has same keys as en.json
      expect(Object.keys(baselineEs).sort()).toEqual(Object.keys(baselineEn).sort());

      // ── Step 2: Delete the main source file ─────────────────────────
      // page.tsx contains ALL translatable strings in the fixture
      // (layout.tsx has no translatable content)
      const pagePath = join(deletionWorkDir, 'app/[locale]/page.tsx');
      await rm(pagePath);

      // ── Step 3: Re-extract after deletion ───────────────────────────
      const extract2 = runCli(['extract'], deletionWorkDir);
      expect(await extract2.exited).toBe(0);

      const postDeleteManifest = await readJson<Manifest>(join(deletionOutDir(), 'manifest.json'));
      const postDeleteEn = await readJson<Record<string, string>>(join(deletionOutDir(), 'en.json'));
      const postDeleteEntryCount = Object.keys(postDeleteManifest.entries).length;

      // Entries from page.tsx are gone — since it's the only source file
      // with translatable content, manifest should now be empty
      expect(postDeleteEntryCount).toBe(0);
      expect(postDeleteEntryCount).toBeLessThan(baselineEntryCount);
      expect(Object.keys(postDeleteEn)).toHaveLength(0);

      // ── Step 4: Re-translate — es.json should match the empty manifest ─
      const translate2 = runCli(['translate'], deletionWorkDir, { TYNDALE_MOCK_TRANSLATE: '1' });
      expect(await translate2.exited).toBe(0);

      const postDeleteEs = await readJson<Record<string, string>>(join(deletionOutDir(), 'es.json'));

      // No stale keys from the deleted file survive
      expect(Object.keys(postDeleteEs).sort()).toEqual(Object.keys(postDeleteEn).sort());
      expect(Object.keys(postDeleteEs)).toHaveLength(0);

      // Every baseline hash is gone
      for (const hash of Object.keys(baselineManifest.entries)) {
        expect(postDeleteEs[hash]).toBeUndefined();
        expect(postDeleteManifest.entries[hash]).toBeUndefined();
      }
    });
  });
});
