// packages/tyndale/tests/commands/init-cli.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('tyndale init (CLI integration)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tyndale-init-cli-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('runs init and creates config for a Next.js project', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    );

    const proc = Bun.spawn(
      ['bun', 'run', join(__dirname, '../../src/cli.ts'), 'init', '--default-locale', 'en', '--locales', 'es,fr'],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
    );
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);

    const configRaw = await readFile(join(dir, 'tyndale.config.json'), 'utf-8');
    const config = JSON.parse(configRaw);
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['es', 'fr']);

    // Middleware created
    const middleware = await readFile(join(dir, 'middleware.ts'), 'utf-8');
    expect(middleware).toContain('createTyndaleMiddleware');
  });

  it('exits 1 when tyndale.config.json already exists', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } }),
    );
    await writeFile(join(dir, 'tyndale.config.json'), '{}');

    const proc = Bun.spawn(
      ['bun', 'run', join(__dirname, '../../src/cli.ts'), 'init', '--default-locale', 'en', '--locales', 'es'],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
    );
    const exitCode = await proc.exited;
    expect(exitCode).toBe(1);
  });
});
