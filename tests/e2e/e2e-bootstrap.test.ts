// tests/e2e/e2e-bootstrap.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFile, rm, writeFile, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * End-to-end test: bootstrap flow from zero config.
 *
 * 1. Creates a minimal Next.js-like project (package.json + source file, NO tyndale config)
 * 2. Runs `tyndale init` with flags
 * 3. Verifies config was scaffolded correctly
 * 4. Runs `tyndale extract`
 * 5. Runs `tyndale translate` (mock)
 * 6. Verifies all locale files are produced
 */

const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

describe('E2E: bootstrap (init → extract → translate)', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-bootstrap-'));

    // Minimal package.json — `next` in deps triggers Next.js framework detection
    await writeFile(
      join(workDir, 'package.json'),
      JSON.stringify({
        name: 'bootstrap-test',
        dependencies: { next: '14.0.0', react: '18.0.0' },
      }),
    );

    // Source file using <T> from tyndale-react
    await mkdir(join(workDir, 'app'), { recursive: true });
    await writeFile(
      join(workDir, 'app/page.tsx'),
      `import { T } from 'tyndale-react';\nexport default function Page() { return <T><h1>Hello World</h1></T>; }\n`,
    );
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('bootstrap flow: init → extract → translate produces locale files', async () => {
    // ── Step 1: init ──────────────────────────────────────────────────
    const initProc = Bun.spawn(
      ['bun', 'run', CLI_PATH, 'init', '--default-locale', 'en', '--locales', 'es,fr'],
      {
        cwd: workDir,
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    const initExitCode = await initProc.exited;
    expect(initExitCode).toBe(0);

    // Verify config file
    const configRaw = await readFile(join(workDir, 'tyndale.config.json'), 'utf-8');
    const config = JSON.parse(configRaw);

    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['es', 'fr']);
    expect(config.source).toBeArray();
    expect(config.source).toContain('app');
    expect(config.output).toBe('public/_tyndale');
    expect(config.extensions).toBeArray();

    // Verify .gitignore was updated
    const gitignore = await readFile(join(workDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('_tyndale');

    // ── Step 2: extract ───────────────────────────────────────────────
    const extractProc = Bun.spawn(['bun', 'run', CLI_PATH, 'extract'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const extractExitCode = await extractProc.exited;
    expect(extractExitCode).toBe(0);

    // Verify manifest
    const manifestRaw = await readFile(join(workDir, 'public/_tyndale/manifest.json'), 'utf-8');
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.version).toBe(1);
    expect(manifest.defaultLocale).toBe('en');
    expect(manifest.locales).toEqual(['es', 'fr']);
    expect(Object.keys(manifest.entries).length).toBeGreaterThan(0);

    // Verify en.json has entries matching the manifest
    const enRaw = await readFile(join(workDir, 'public/_tyndale/en.json'), 'utf-8');
    const en = JSON.parse(enRaw) as Record<string, string>;

    for (const hash of Object.keys(manifest.entries)) {
      expect(en[hash]).toBeDefined();
    }

    // Should contain our source string
    const values = Object.values(en);
    expect(values.some((v) => v.includes('Hello World'))).toBe(true);

    // ── Step 3: translate ─────────────────────────────────────────────
    const translateProc = Bun.spawn(['bun', 'run', CLI_PATH, 'translate'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        TYNDALE_MOCK_TRANSLATE: '1',
      },
    });

    const translateExitCode = await translateProc.exited;
    expect(translateExitCode).toBe(0);

    const enKeys = Object.keys(en).sort();

    // Verify es.json
    const esRaw = await readFile(join(workDir, 'public/_tyndale/es.json'), 'utf-8');
    const es = JSON.parse(esRaw) as Record<string, string>;
    expect(Object.keys(es).sort()).toEqual(enKeys);

    for (const [hash, value] of Object.entries(es)) {
      expect(value).toStartWith('[es] ');
      expect(value.slice(5)).toBe(en[hash]);
    }

    // Verify fr.json
    const frRaw = await readFile(join(workDir, 'public/_tyndale/fr.json'), 'utf-8');
    const fr = JSON.parse(frRaw) as Record<string, string>;
    expect(Object.keys(fr).sort()).toEqual(enKeys);

    for (const [hash, value] of Object.entries(fr)) {
      expect(value).toStartWith('[fr] ');
      expect(value.slice(5)).toBe(en[hash]);
    }
  });
});
