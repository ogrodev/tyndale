// tests/e2e/e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFile, rm, cp, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * End-to-end test: exercises the full tyndale pipeline.
 *
 * Two self-contained tests:
 * 1. Full pipeline: extract → validate → translate → idempotent
 * 2. Wire format: extract → verify numbered tags and placeholders
 */

const FIXTURE_DIR = join(__dirname, 'fixture');
const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

describe('E2E: extract → translate → verify', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-'));
    // Copy fixture to temp dir
    await cp(FIXTURE_DIR, workDir, { recursive: true });
    // Remove any Playwright-seeded artefacts so the test starts from a clean fixture.
    await rm(join(workDir, 'public'), { recursive: true, force: true });
    await rm(join(workDir, '.next'), { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('full pipeline: extract → validate → translate → idempotent', async () => {
    // ── Step 1: extract ──
    const extractProc = Bun.spawn(['bun', 'run', CLI_PATH, 'extract'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(await extractProc.exited).toBe(0);

    // Verify manifest.json
    const manifestRaw = await readFile(join(workDir, 'public/_tyndale/manifest.json'), 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.version).toBe(1);
    expect(manifest.defaultLocale).toBe('en');
    expect(manifest.locales).toEqual(['es']);
    expect(Object.keys(manifest.entries).length).toBeGreaterThan(0);

    // Verify entry types are present
    const entryTypes = new Set(Object.values(manifest.entries).map((e: any) => e.type));
    expect(entryTypes.has('jsx')).toBe(true);
    expect(entryTypes.has('string')).toBe(true);

    // Verify en.json
    const enRaw = await readFile(join(workDir, 'public/_tyndale/en.json'), 'utf-8');
    const en = JSON.parse(enRaw) as Record<string, string>;
    const enValues = Object.values(en);

    // Should contain our source strings
    expect(enValues.some((v) => v.includes('Welcome to Tyndale'))).toBe(true);
    expect(enValues.some((v) => v.includes('{user}'))).toBe(true);
    expect(enValues.some((v) => v.includes('Search products...'))).toBe(true);
    expect(enValues.some((v) => v.includes('Sign in'))).toBe(true);
    expect(enValues.some((v) => v.includes('Home'))).toBe(true);
    expect(enValues.some((v) => v.includes('About'))).toBe(true);

    // All manifest entry hashes should appear in en.json
    for (const hash of Object.keys(manifest.entries)) {
      expect(en[hash]).toBeDefined();
    }

    // ── Step 2: validate ──
    const validateProc = Bun.spawn(['bun', 'run', CLI_PATH, 'validate'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(await validateProc.exited).toBe(0);

    // ── Step 3: translate ──
    // TYNDALE_MOCK_TRANSLATE=1 enables a mock translator that prefixes
    // each value with "[es] " instead of calling Pi.
    const translateProc = Bun.spawn(['bun', 'run', CLI_PATH, 'translate'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        TYNDALE_MOCK_TRANSLATE: '1',
      },
    });
    expect(await translateProc.exited).toBe(0);

    // Verify es.json exists and has same keys as en.json
    const esRaw = await readFile(join(workDir, 'public/_tyndale/es.json'), 'utf-8');
    const es = JSON.parse(esRaw) as Record<string, string>;

    // Same set of keys
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());

    // Mock translations should be prefixed with "[es] "
    for (const [hash, value] of Object.entries(es)) {
      expect(value).toStartWith('[es] ');
      // The rest should be the source content (mock just prefixes)
      expect(value.slice(5)).toBe(en[hash]);
    }

    // ── Step 4: idempotent ──
    const retranslateProc = Bun.spawn(['bun', 'run', CLI_PATH, 'translate'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        TYNDALE_MOCK_TRANSLATE: '1',
      },
    });
    expect(await retranslateProc.exited).toBe(0);

    const esRaw2 = await readFile(join(workDir, 'public/_tyndale/es.json'), 'utf-8');
    expect(esRaw2).toBe(esRaw);
  });

  it('wire format preserves numbered tags and variable placeholders', async () => {
    // Run extract so this test is self-contained
    const proc = Bun.spawn(['bun', 'run', CLI_PATH, 'extract'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(await proc.exited).toBe(0);

    const enRaw = await readFile(join(workDir, 'public/_tyndale/en.json'), 'utf-8');
    const en = JSON.parse(enRaw) as Record<string, string>;
    const values = Object.values(en);

    // The JSX with <h1> and <p> should have numbered tags
    const welcomeEntry = values.find((v) => v.includes('Welcome to Tyndale'));
    expect(welcomeEntry).toBeDefined();
    expect(welcomeEntry).toMatch(/<\d>/); // Contains numbered tags

    // The variable entry should have {user} and {count} placeholders
    const varEntry = values.find((v) => v.includes('{user}'));
    expect(varEntry).toBeDefined();
    expect(varEntry).toContain('{user}');
  });
});
