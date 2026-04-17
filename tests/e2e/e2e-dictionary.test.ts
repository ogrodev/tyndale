// tests/e2e/e2e-dictionary.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { readFile, writeFile, rm, cp, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * E2E: dictionary extraction and translation.
 *
 * Dictionaries are a distinct codepath from JSX/string extraction.
 * This test verifies the full pipeline: config → extract → manifest → translate.
 */

const FIXTURE_DIR = join(__dirname, 'fixture');
const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

const DICTIONARY_CONTENT = {
  greeting: 'Hello',
  farewell: 'Goodbye',
  welcome_message: 'Welcome to our app',
};

describe('E2E: dictionary extraction and translation', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-dict-'));

    // Copy fixture to temp dir
    await cp(FIXTURE_DIR, workDir, { recursive: true });
    // Remove any Playwright-seeded artefacts so the test starts from a clean fixture.
    await rm(join(workDir, 'public'), { recursive: true, force: true });
    await rm(join(workDir, '.next'), { recursive: true, force: true });

    // Update config to enable dictionary extraction
    const configPath = join(workDir, 'tyndale.config.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    config.dictionaries = {
      include: ['src/dictionaries/**/*.json'],
      format: 'key-value',
    };
    await writeFile(configPath, JSON.stringify(config, null, 2));

    // Create dictionary file
    const dictDir = join(workDir, 'src/dictionaries');
    await mkdir(dictDir, { recursive: true });
    await writeFile(
      join(dictDir, 'common.json'),
      JSON.stringify(DICTIONARY_CONTENT, null, 2),
    );
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('extract produces manifest with dictionary entries', async () => {
    const proc = Bun.spawn(['bun', 'run', CLI_PATH, 'extract'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`extract failed (exit ${exitCode}): ${stderr}`);
    }

    // Verify manifest.json exists and has dictionary entries
    const manifestRaw = await readFile(
      join(workDir, 'public/_tyndale/manifest.json'),
      'utf-8',
    );
    const manifest = JSON.parse(manifestRaw);

    const entries = Object.values(manifest.entries) as Array<{
      type: string;
      dictKey?: string;
      dictFile?: string;
    }>;

    // Filter to dictionary entries only
    const dictEntries = entries.filter((e) => e.type === 'dictionary');
    expect(dictEntries.length).toBe(3);

    // Each dictionary entry must have dictKey and dictFile metadata
    for (const entry of dictEntries) {
      expect(entry.dictKey).toBeDefined();
      expect(entry.dictFile).toBe('common');
    }

    // Verify all three keys are present
    const dictKeys = dictEntries.map((e) => e.dictKey).sort();
    expect(dictKeys).toEqual(['farewell', 'greeting', 'welcome_message']);
  });

  it('en.json contains dictionary values', async () => {
    const enRaw = await readFile(
      join(workDir, 'public/_tyndale/en.json'),
      'utf-8',
    );
    const en = JSON.parse(enRaw) as Record<string, string>;

    const enValues = Object.values(en);

    // All dictionary values must appear in en.json
    for (const value of Object.values(DICTIONARY_CONTENT)) {
      expect(enValues).toContain(value);
    }
  });

  it('translate produces es.json with translated dictionary entries', async () => {
    const proc = Bun.spawn(['bun', 'run', CLI_PATH, 'translate'], {
      cwd: workDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        TYNDALE_MOCK_TRANSLATE: '1',
      },
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`translate failed (exit ${exitCode}): ${stderr}`);
    }

    // Read both locale files
    const enRaw = await readFile(
      join(workDir, 'public/_tyndale/en.json'),
      'utf-8',
    );
    const esRaw = await readFile(
      join(workDir, 'public/_tyndale/es.json'),
      'utf-8',
    );
    const en = JSON.parse(enRaw) as Record<string, string>;
    const es = JSON.parse(esRaw) as Record<string, string>;

    // es.json should have the same keys as en.json
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());

    // Find dictionary hashes by matching en values to our known dictionary content
    const dictValues = Object.values(DICTIONARY_CONTENT);
    const dictHashes = Object.entries(en)
      .filter(([_, value]) => dictValues.includes(value))
      .map(([hash]) => hash);

    expect(dictHashes.length).toBe(3);

    // Mock translations should be prefixed with "[es] "
    for (const hash of dictHashes) {
      expect(es[hash]).toStartWith('[es] ');
      expect(es[hash].slice(5)).toBe(en[hash]);
    }
  });
});
