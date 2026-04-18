/**
 * Layer 2 portability E2E.
 *
 * Flow per runtime (node, bun):
 *   1. tarball the 3 published packages with `bun pm pack`
 *   2. npm-install them into a fresh throwaway project
 *   3. invoke `node|bun dist/cli.js` for extract + validate
 *   4. dynamic-import `tyndale-react` and `tyndale-react/server` from that project
 *
 * What this catches that dev-harness tests miss:
 *   - stale `dist/` (workspace symlinks otherwise shadow source changes)
 *   - ESM imports without `.js` extensions
 *   - Bun-only globals in shipped bins
 *   - peerDep resolution failures from a real install
 *
 * Runtime budget: ~30s per runtime on a warm npm cache. Skippable via
 * `SKIP_PORTABILITY_E2E=1` for inner-loop dev.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertImport,
  installFixture,
  packPackages,
  readFixtureJson,
  runCli,
  type Runtime,
} from '../portability/harness';

const SKIP = process.env.SKIP_PORTABILITY_E2E === '1';

describe.skipIf(SKIP)('portability: packed install runs under Node and Bun', () => {
  let scratchDir: string;
  let tarballs: Record<string, string>;

  beforeAll(async () => {
    scratchDir = await mkdtemp(join(tmpdir(), 'tyndale-portability-'));
    tarballs = await packPackages(scratchDir);
  }, 300_000);

  afterAll(async () => {
    if (scratchDir) await rm(scratchDir, { recursive: true, force: true });
  }, 300_000);

  const RUNTIMES: Runtime[] = ['node', 'bun'];

  for (const runtime of RUNTIMES) {
    describe(`runtime=${runtime}`, () => {
      let projectDir: string;

      beforeAll(async () => {
        projectDir = await installFixture(scratchDir, tarballs);
      }, 300_000);

      test(`${runtime}: tyndale --help prints usage`, async () => {
        const res = await runCli(runtime, projectDir, ['--help']);
        if (res.exitCode !== 0 || !res.stdout.includes('tyndale')) {
          throw new Error(
            `[${runtime}] --help failed:\n` +
              `  exit=${res.exitCode}\n` +
              `  stdout(${res.stdout.length})=${JSON.stringify(res.stdout.slice(0, 300))}\n` +
              `  stderr(${res.stderr.length})=${JSON.stringify(res.stderr.slice(0, 300))}`,
          );
        }
        expect(res.stdout).toContain('extract');
        expect(res.stdout).toContain('translate');
      });

      test(`${runtime}: tyndale extract emits a manifest with the fixture strings`, async () => {
        const res = await runCli(runtime, projectDir, ['extract']);
        expect(res.exitCode).toBe(0);

        const manifest = await readFixtureJson<{
          version: number;
          defaultLocale: string;
          locales: string[];
          entries: Record<string, { type: string; context: string }>;
        }>(projectDir, 'public/_tyndale/manifest.json');

        expect(manifest.version).toBe(1);
        expect(manifest.defaultLocale).toBe('en');
        expect(manifest.locales).toEqual(['es']);
        // Three extracted entries: one <T> jsx entry + two msgString entries.
        expect(Object.keys(manifest.entries).length).toBe(3);
        const types = new Set(Object.values(manifest.entries).map((e) => e.type));
        expect(types.has('jsx')).toBe(true);
        expect(types.has('string')).toBe(true);

        // Wire formats live in the locale JSON, keyed by the same hash.
        const en = await readFixtureJson<Record<string, string>>(
          projectDir,
          'public/_tyndale/en.json',
        );
        const values = Object.values(en);
        expect(values).toContain('Welcome to Tyndale.');
        expect(values).toContain('Hello, world.');
        expect(values).toContain('Get started with Tyndale.');
      });

      test(`${runtime}: tyndale validate succeeds against the extracted manifest`, async () => {
        const res = await runCli(runtime, projectDir, ['validate']);
        expect(res.exitCode).toBe(0);
        expect(res.stdout).toMatch(/validated|0 errors/);
      });

      test(`${runtime}: tyndale-react dynamic import exposes the public surface`, async () => {
        await assertImport(runtime, projectDir, 'tyndale-react', [
          'T',
          'Plural',
          'TyndaleProvider',
          'useTranslation',
          'msgString',
          'computeHash',
        ]);
      });

      test(`${runtime}: tyndale-react/server exposes getTranslation`, async () => {
        await assertImport(runtime, projectDir, 'tyndale-react/server', [
          'getTranslation',
        ]);
      });
    });
  }
});
