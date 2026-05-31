// packages/tyndale-next/tests/exports.test.ts
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function assertSpawnOk(result: ReturnType<typeof spawnSync>, label: string) {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

function parseSpawnJson(result: ReturnType<typeof spawnSync>, label: string) {
  try {
    return JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    throw new Error(
      `${label} emitted invalid JSON\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
}

describe('tyndale-next main exports', () => {
  test('exports TyndaleServerProvider', async () => {
    const mod = await import('../src/index');
    expect(mod.TyndaleServerProvider).toBeDefined();
    expect(typeof mod.TyndaleServerProvider).toBe('function');
  });

  test('exports TyndaleNextClientProvider', async () => {
    const mod = await import('../src/index');
    expect(mod.TyndaleNextClientProvider).toBeDefined();
    expect(typeof mod.TyndaleNextClientProvider).toBe('function');
  });

  test('exports generateStaticLocaleParams', async () => {
    const mod = await import('../src/index');
    expect(mod.generateStaticLocaleParams).toBeDefined();
    expect(typeof mod.generateStaticLocaleParams).toBe('function');
  });

  test('exports useDirection', async () => {
    const mod = await import('../src/index');
    expect(mod.useDirection).toBeDefined();
    expect(typeof mod.useDirection).toBe('function');
  });

  test('exports TyndaleCache', async () => {
    const mod = await import('../src/index');
    expect(mod.TyndaleCache).toBeDefined();
    expect(typeof mod.TyndaleCache).toBe('function');
  });
});

describe('tyndale-next/config subpath', () => {
  test('exports withTyndaleConfig', async () => {
    const mod = await import('../src/config');
    expect(mod.withTyndaleConfig).toBeDefined();
    expect(typeof mod.withTyndaleConfig).toBe('function');
  });
  test('loads from CommonJS and ESM config loaders', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'tyndale-next-exports-'));

    try {
      const packageDir = join(workDir, 'node_modules', 'tyndale-next');
      const distDir = join(packageDir, 'dist');
      await mkdir(distDir, { recursive: true });
      await writeFile(
        join(packageDir, 'package.json'),
        await readFile(join(PKG_ROOT, 'package.json'), 'utf-8'),
      );

      const transpiled = ts.transpileModule(
        await readFile(join(PKG_ROOT, 'src', 'config.ts'), 'utf-8'),
        {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
          },
        },
      );
      await writeFile(join(distDir, 'config.js'), transpiled.outputText);
      await writeFile(
        join(distDir, 'config.cjs'),
        await readFile(join(PKG_ROOT, 'src', 'config.cjs'), 'utf-8'),
      );

      const reactDir = join(workDir, 'node_modules', 'tyndale-react');
      await mkdir(join(reactDir, 'dist'), { recursive: true });
      await writeFile(
        join(reactDir, 'package.json'),
        JSON.stringify({
          name: 'tyndale-react',
          version: '0.0.0',
          type: 'module',
          exports: {
            '.': {
              types: './dist/index.d.ts',
              import: './dist/index.js',
            },
            './server': {
              types: './dist/server.d.ts',
              import: './dist/server.js',
            },
          },
        }),
      );
      await writeFile(join(reactDir, 'dist', 'index.js'), 'export {};');
      await writeFile(join(reactDir, 'dist', 'server.js'), 'export {};');
      const expectedReactEntry = await realpath(
        join(reactDir, 'dist', 'index.js'),
      );
      const expectedReactTurbopackEntry = './node_modules/tyndale-react/dist/index.js';
      const expectedReactServerTurbopackEntry =
        './node_modules/tyndale-react/dist/server.js';
      await writeFile(
        join(workDir, 'tyndale.config.json'),
        JSON.stringify({
          defaultLocale: 'en',
          locales: ['es', 'fr'],
          output: 'public/_tyndale',
          localeAliases: {},
        }),
      );

      const cjs = spawnSync(
        'node',
        [
          '-e',
          "const { withTyndaleConfig } = require('tyndale-next/config'); const config = withTyndaleConfig({}); const aliases = config.webpack({ resolve: { alias: { 'tyndale-react': '/stale-prefix-alias' } } }, {}).resolve.alias; const turboAliases = config.turbopack.resolveAlias; console.log(JSON.stringify({ defaultLocale: config.env.TYNDALE_DEFAULT_LOCALE, rootAlias: aliases['tyndale-react$'] ?? null, prefixAlias: aliases['tyndale-react'] ?? null, serverAlias: aliases['tyndale-react/server'] ?? null, turboRootAlias: turboAliases['tyndale-react'] ?? null, turboServerAlias: turboAliases['tyndale-react/server'] ?? null }));",
        ],
        { cwd: workDir, encoding: 'utf-8' },
      );
      assertSpawnOk(cjs, 'CommonJS config loader');
      const cjsConfig = parseSpawnJson(cjs, 'CommonJS config loader');
      expect(cjsConfig.defaultLocale).toBe('en');
      expect(cjsConfig.rootAlias).toBe(expectedReactEntry);
      expect(cjsConfig.prefixAlias).toBeNull();
      expect(cjsConfig.serverAlias).toBeNull();
      expect(cjsConfig.turboRootAlias).toBe(expectedReactTurbopackEntry);
      expect(cjsConfig.turboServerAlias).toBe(expectedReactServerTurbopackEntry);

      const esm = spawnSync(
        'node',
        [
          '--input-type=module',
          '-e',
          "import { withTyndaleConfig } from 'tyndale-next/config'; const config = withTyndaleConfig({}); const aliases = config.webpack({ resolve: { alias: { 'tyndale-react': '/stale-prefix-alias' } } }, {}).resolve.alias; const turboAliases = config.turbopack.resolveAlias; console.log(JSON.stringify({ locales: config.env.TYNDALE_LOCALES, rootAlias: aliases['tyndale-react$'] ?? null, prefixAlias: aliases['tyndale-react'] ?? null, serverAlias: aliases['tyndale-react/server'] ?? null, turboRootAlias: turboAliases['tyndale-react'] ?? null, turboServerAlias: turboAliases['tyndale-react/server'] ?? null }));",
        ],
        { cwd: workDir, encoding: 'utf-8' },
      );
      assertSpawnOk(esm, 'ESM config loader');
      const esmConfig = parseSpawnJson(esm, 'ESM config loader');
      expect(esmConfig.locales).toBe('["es","fr"]');
      expect(esmConfig.rootAlias).toBe(expectedReactEntry);
      expect(esmConfig.prefixAlias).toBeNull();
      expect(esmConfig.serverAlias).toBeNull();
      expect(esmConfig.turboRootAlias).toBe(expectedReactTurbopackEntry);
      expect(esmConfig.turboServerAlias).toBe(expectedReactServerTurbopackEntry);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });
});

describe('tyndale-next/middleware subpath', () => {
  test('exports createTyndaleMiddleware', async () => {
    const mod = await import('../src/middleware');
    expect(mod.createTyndaleMiddleware).toBeDefined();
    expect(typeof mod.createTyndaleMiddleware).toBe('function');
  });
});
