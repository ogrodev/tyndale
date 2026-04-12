// tests/e2e/e2e-error-paths.test.ts
import { describe, it, expect } from 'bun:test';
import { rm, mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

const TYNDALE_CONFIG = JSON.stringify(
  {
    defaultLocale: 'en',
    locales: ['es'],
    source: ['app'],
    output: 'public/_tyndale',
    extensions: ['.ts', '.tsx'],
  },
  null,
  2,
);

/** Spawn a CLI command, returning exit code + captured output. */
async function runCli(args: string[], cwd: string, env?: Record<string, string>) {
  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...env },
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return { exitCode, stdout, stderr, output: stdout + stderr };
}

describe('E2E: error paths', () => {
  it('translate without prior extract exits non-zero', async () => {
    // Setup: config exists but no extract has been run, so no manifest.json
    const workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-err-translate-'));
    try {
      await writeFile(join(workDir, 'tyndale.config.json'), TYNDALE_CONFIG);

      const { exitCode, output } = await runCli(['translate'], workDir, {
        TYNDALE_MOCK_TRANSLATE: '1',
      });

      expect(exitCode).not.toBe(0);
      // Should mention the missing manifest or that no translations are available
      const lower = output.toLowerCase();
      expect(lower.includes('manifest') || lower.includes('extract') || lower.includes('no ')).toBe(
        true,
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('extract with missing config exits non-zero with helpful message', async () => {
    // Setup: a source file exists but no tyndale.config.json
    const workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-err-noconfig-'));
    try {
      await mkdir(join(workDir, 'app'), { recursive: true });
      await writeFile(
        join(workDir, 'app/page.tsx'),
        `import { T } from 'tyndale-react';\nexport default () => <T>Hello</T>;\n`,
      );

      const { exitCode, output } = await runCli(['extract'], workDir);

      expect(exitCode).not.toBe(0);
      // Should reference the missing config file
      const lower = output.toLowerCase();
      expect(lower.includes('config') || lower.includes('tyndale.config')).toBe(true);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('extract on project with no translatable files exits 0', async () => {
    // Setup: valid config pointing at an empty source directory
    const workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-err-empty-'));
    try {
      const config = {
        defaultLocale: 'en',
        locales: ['es'],
        source: ['src'],
        output: 'public/_tyndale',
        extensions: ['.ts', '.tsx'],
      };
      await writeFile(join(workDir, 'tyndale.config.json'), JSON.stringify(config, null, 2));
      await mkdir(join(workDir, 'src'), { recursive: true });

      const { exitCode } = await runCli(['extract'], workDir);

      // Not an error — just nothing to extract
      expect(exitCode).toBe(0);

      // Manifest should exist with zero entries
      const manifestPath = join(workDir, 'public/_tyndale/manifest.json');
      const manifestRaw = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestRaw);
      expect(manifest.entries).toBeDefined();
      expect(Object.keys(manifest.entries).length).toBe(0);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
