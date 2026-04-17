// packages/tyndale/tests/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectFramework, scaffoldConfig, runInit } from '../../src/commands/init';

describe('detectFramework', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tyndale-init-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('detects Next.js from dependencies', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    );
    const result = await detectFramework(dir);
    expect(result).toBe('nextjs');
  });

  it('detects Next.js from devDependencies', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { next: '15.0.0' }, dependencies: { react: '18.0.0' } }),
    );
    const result = await detectFramework(dir);
    expect(result).toBe('nextjs');
  });

  it('detects Vite+React', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' }, devDependencies: { vite: '5.0.0' } }),
    );
    const result = await detectFramework(dir);
    expect(result).toBe('vite-react');
  });

  it('detects plain React when no bundler found', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } }),
    );
    const result = await detectFramework(dir);
    expect(result).toBe('react');
  });

  it('throws when no package.json exists', async () => {
    await expect(detectFramework(dir)).rejects.toThrow('package.json');
  });

  it('throws when react is not a dependency', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { express: '4.0.0' } }),
    );
    await expect(detectFramework(dir)).rejects.toThrow('React');
  });
});

describe('scaffoldConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tyndale-init-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('creates tyndale.config.json with correct defaults for Next.js', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es', 'fr'],
    });

    const configRaw = await readFile(join(dir, 'tyndale.config.json'), 'utf-8');
    const config = JSON.parse(configRaw);
    expect(config).toEqual({
      defaultLocale: 'en',
      locales: ['es', 'fr'],
      source: ['app', 'src'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.astro'],
      output: 'public/_tyndale',
      translate: {},
      localeAliases: {},
      dictionaries: {
        include: ['src/dictionaries/*.json'],
        format: 'key-value',
      },
      pi: {
        model: 'claude-sonnet-4-20250514',
        thinkingLevel: 'low',
      },
    });
  });

  it('creates tyndale.config.json with Vite defaults', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' }, devDependencies: { vite: '5.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['ja'],
    });

    const configRaw = await readFile(join(dir, 'tyndale.config.json'), 'utf-8');
    const config = JSON.parse(configRaw);
    expect(config.source).toEqual(['src']);
  });

  it('appends public/_tyndale/ to .gitignore', async () => {
    await writeFile(join(dir, '.gitignore'), 'node_modules/\n');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es'],
    });

    const gitignore = await readFile(join(dir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('public/_tyndale/');
    // Original content preserved
    expect(gitignore).toContain('node_modules/');
  });

  it('creates .gitignore if it does not exist', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es'],
    });

    const gitignore = await readFile(join(dir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('public/_tyndale/');
  });

  it('does not duplicate .gitignore entry on re-run', async () => {
    await writeFile(join(dir, '.gitignore'), 'node_modules/\npublic/_tyndale/\n');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es'],
    });

    const gitignore = await readFile(join(dir, '.gitignore'), 'utf-8');
    const matches = gitignore.match(/public\/_tyndale\//g);
    expect(matches).toHaveLength(1);
  });

  it('scaffolds middleware.ts for Next.js projects', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es', 'fr'],
    });

    const middleware = await readFile(join(dir, 'middleware.ts'), 'utf-8');
    expect(middleware).toContain('createTyndaleMiddleware');
    expect(middleware).toContain("'/((?!api|_next|_tyndale|.*\\\\..*).*)");
  });

  it('does not create middleware.ts for non-Next.js projects', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' }, devDependencies: { vite: '5.0.0' } }),
    );
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es'],
    });

    await expect(stat(join(dir, 'middleware.ts'))).rejects.toThrow();
  });

  it('does not overwrite existing middleware.ts', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    );
    await writeFile(join(dir, 'middleware.ts'), '// custom middleware\nexport default function() {}');
    await scaffoldConfig(dir, {
      defaultLocale: 'en',
      locales: ['es'],
    });

    const middleware = await readFile(join(dir, 'middleware.ts'), 'utf-8');
    expect(middleware).toBe('// custom middleware\nexport default function() {}');
  });

  it('does not overwrite existing tyndale.config.json', async () => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { react: '18.0.0' } }),
    );
    const existing = JSON.stringify({ defaultLocale: 'pt', locales: ['en'] });
    await writeFile(join(dir, 'tyndale.config.json'), existing);

    await expect(
      scaffoldConfig(dir, { defaultLocale: 'en', locales: ['es'] }),
    ).rejects.toThrow('tyndale.config.json already exists');
  });
});


describe('runInit', () => {
  let dir: string;
  let originalCwd: () => string;
  let originalStdin: NodeJS.ReadStream;
  let logs: string[];
  let errors: string[];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tyndale-init-'));
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '14.0.0', react: '18.0.0' } }),
    );
    originalCwd = process.cwd;
    process.cwd = () => dir;
    logs = [];
    errors = [];
    originalLog = console.log;
    originalError = console.error;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    console.error = (...args: unknown[]) => errors.push(args.join(' '));
  });

  afterEach(async () => {
    process.cwd = originalCwd;
    console.log = originalLog;
    console.error = originalError;
    await rm(dir, { recursive: true, force: true });
  });

  it('rejects when tyndale.config.json already exists', async () => {
    // First init succeeds
    const result1 = await runInit({ 'default-locale': 'en', locales: 'es' });
    expect(result1.exitCode).toBe(0);

    // Second init should fail
    const result2 = await runInit({ 'default-locale': 'en', locales: 'es' });
    expect(result2.exitCode).toBe(1);
    expect(errors.some(e => e.includes('already exists'))).toBe(true);
  });

  it('skips prompts when flags are provided', async () => {
    const result = await runInit({ 'default-locale': 'en', locales: 'es,fr' });
    expect(result.exitCode).toBe(0);
    expect(logs.some(l => l.includes('Detected framework: Next.js'))).toBe(true);
    expect(logs.some(l => l.includes('Created:'))).toBe(true);
    const config = JSON.parse(await readFile(join(dir, 'tyndale.config.json'), 'utf-8'));
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['es', 'fr']);
  });

  it('prompts interactively when flags are missing', async () => {
    // Mock stdin to provide interactive input
    const { PassThrough } = await import('node:stream');
    const mockStdin = new PassThrough() as unknown as NodeJS.ReadStream;
    originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', { value: mockStdin, writable: true, configurable: true });

    // Schedule input after a tick so readLine can attach listener
    setTimeout(() => {
      mockStdin.write('pt\n');
      setTimeout(() => mockStdin.write('es,ja\n'), 10);
    }, 10);

    const result = await runInit({});
    expect(result.exitCode).toBe(0);

    const config = JSON.parse(await readFile(join(dir, 'tyndale.config.json'), 'utf-8'));
    expect(config.defaultLocale).toBe('pt');
    expect(config.locales).toEqual(['es', 'ja']);

    Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true, configurable: true });
  });

  it('uses default locale when interactive input is empty', async () => {
    const { PassThrough } = await import('node:stream');
    const mockStdin = new PassThrough() as unknown as NodeJS.ReadStream;
    originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', { value: mockStdin, writable: true, configurable: true });

    setTimeout(() => {
      mockStdin.write('\n');
      setTimeout(() => mockStdin.write('fr\n'), 10);
    }, 10);

    const result = await runInit({});
    expect(result.exitCode).toBe(0);

    const config = JSON.parse(await readFile(join(dir, 'tyndale.config.json'), 'utf-8'));
    expect(config.defaultLocale).toBe('en');
    expect(config.locales).toEqual(['fr']);

    Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true, configurable: true });
  });

  it('errors when interactive locales input is empty', async () => {
    const { PassThrough } = await import('node:stream');
    const mockStdin = new PassThrough() as unknown as NodeJS.ReadStream;
    originalStdin = process.stdin;
    Object.defineProperty(process, 'stdin', { value: mockStdin, writable: true, configurable: true });

    setTimeout(() => {
      mockStdin.write('en\n');
      setTimeout(() => mockStdin.write('\n'), 10);
    }, 10);

    const result = await runInit({});
    expect(result.exitCode).toBe(1);
    expect(errors.some(e => e.includes('at least one target locale'))).toBe(true);

    Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true, configurable: true });
  });
});