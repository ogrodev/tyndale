/**
 * End-to-end portability harness.
 *
 * Simulates a real user install: packs each published package to a tarball,
 * installs the tarballs into a throwaway project, and exposes helpers to run
 * the CLI under an arbitrary runtime (`node` / `bun`) and to load the
 * libraries via dynamic import from that project's node_modules.
 *
 * The dev-harness path (workspace symlinks + bundler transforms) hides a
 * class of bugs — stale `dist/`, missing extensions, Bun-only APIs — that
 * only manifest from a published tarball. This is what this harness catches.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, cp, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const PACKAGES = [
  { name: 'tyndale-react', dir: join(REPO_ROOT, 'packages', 'tyndale-react') },
  { name: 'tyndale-next', dir: join(REPO_ROOT, 'packages', 'tyndale-next') },
  { name: 'tyndale', dir: join(REPO_ROOT, 'packages', 'tyndale') },
] as const;

const FIXTURE_TEMPLATE = join(__dirname, 'fixture-template');

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Spawn a command, capture stdout/stderr/exit. */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: Record<string, string>; timeout?: number } = { cwd: process.cwd() },
): Promise<RunResult> {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    const to = setTimeout(() => {
      child.kill('SIGKILL');
      rej(new Error(`timeout running ${cmd} ${args.join(' ')} after ${opts.timeout}ms`));
    }, opts.timeout ?? 120_000);
    child.on('close', (code) => {
      clearTimeout(to);
      res({ stdout, stderr, exitCode: code ?? -1 });
    });
    child.on('error', (err) => {
      clearTimeout(to);
      rej(err);
    });
  });
}

/**
 * Build all packages then pack each to a tarball. Reuses a shared scratch
 * directory so the same tarballs can be installed by multiple test cases.
 */
export async function packPackages(scratchDir: string): Promise<Record<string, string>> {
  const outDir = join(scratchDir, 'tarballs');
  await mkdir(outDir, { recursive: true });

  // Build is caller's responsibility — the test file calls `bun run build:packages`
  // before packing so we don't rebuild for every test case.

  const tarballs: Record<string, string> = {};
  for (const pkg of PACKAGES) {
    // `bun pm pack` rewrites `workspace:*` to the concrete version in the
    // emitted tarball, which is the whole point of running it instead of
    // `npm pack`.
    const result = await run('bun', ['pm', 'pack', '--destination', outDir], {
      cwd: pkg.dir,
      timeout: 60_000,
    });
    if (result.exitCode !== 0) {
      throw new Error(
        `bun pm pack failed for ${pkg.name}:\n${result.stdout}\n${result.stderr}`,
      );
    }
    // Find the produced tarball (the only .tgz matching the pkg name prefix).
    const files = await readdir(outDir);
    const match = files.find(
      (f) => f.startsWith(`${pkg.name}-`) && f.endsWith('.tgz'),
    );
    if (!match) {
      throw new Error(`could not locate packed tarball for ${pkg.name} in ${outDir}`);
    }
    tarballs[pkg.name] = join(outDir, match);
  }
  return tarballs;
}

export interface ProjectOptions {
  /** Which package manager to use for install. Defaults to npm (universal). */
  installer?: 'npm' | 'bun';
  /** Extra deps to add to the fixture package.json. */
  extraDependencies?: Record<string, string>;
}

/**
 * Create a fresh fixture project and install the tarballs into it.
 * Returns the absolute path to the installed project.
 */
export async function installFixture(
  scratchDir: string,
  tarballs: Record<string, string>,
  opts: ProjectOptions = {},
): Promise<string> {
  const projectDir = await mkdtemp(join(scratchDir, 'project-'));
  // Copy static fixture files (src/, tyndale.config.json).
  await cp(FIXTURE_TEMPLATE, projectDir, { recursive: true });

  const pkg = {
    name: 'tyndale-portability-fixture',
    version: '0.0.0',
    private: true,
    type: 'module' as const,
    dependencies: {
      'tyndale-react': `file:${tarballs['tyndale-react']}`,
      ...(opts.extraDependencies ?? {}),
    },
    devDependencies: {
      tyndale: `file:${tarballs['tyndale']}`,
    },
  };
  await writeFile(
    join(projectDir, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n',
  );

  const installer = opts.installer ?? 'npm';
  const args =
    installer === 'npm'
      ? ['install', '--no-audit', '--no-fund', '--loglevel=error']
      : ['install'];
  const installResult = await run(installer, args, {
    cwd: projectDir,
    timeout: 180_000,
  });
  if (installResult.exitCode !== 0) {
    throw new Error(
      `${installer} install failed in ${projectDir}:\n${installResult.stdout}\n${installResult.stderr}`,
    );
  }

  // Sanity: the installed CLI's dist/cli.js must exist with a shebang.
  const cliPath = join(projectDir, 'node_modules', 'tyndale', 'dist', 'cli.js');
  if (!existsSync(cliPath)) {
    throw new Error(`post-install: expected ${cliPath} to exist`);
  }
  return projectDir;
}

export type Runtime = 'node' | 'bun';

/**
 * Run the installed `tyndale` CLI under the given runtime.
 * Invokes the bin file directly rather than relying on `.bin/` wrappers so
 * the test works identically across OSes.
 */
export function runCli(
  runtime: Runtime,
  projectDir: string,
  args: string[],
  timeout = 60_000,
): Promise<RunResult> {
  const cliPath = join(projectDir, 'node_modules', 'tyndale', 'dist', 'cli.js');
  return run(runtime, [cliPath, ...args], { cwd: projectDir, timeout });
}

/**
 * Dynamically import a specifier from the fixture project and assert the
 * returned module has the expected exports. Produces no output on success.
 *
 * We invoke a tiny inline script so the same check runs identically under
 * both `node` and `bun`. The specifier is resolved from the fixture's
 * `node_modules`, i.e., exactly what a real user would resolve.
 */
export async function assertImport(
  runtime: Runtime,
  projectDir: string,
  specifier: string,
  expectedExports: string[],
): Promise<void> {
  const script = `
    const mod = await import(${JSON.stringify(specifier)});
    const missing = ${JSON.stringify(expectedExports)}.filter((k) => !(k in mod));
    if (missing.length > 0) {
      process.stderr.write('MISSING ' + missing.join(','));
      process.exit(1);
    }
    process.stdout.write('OK');
  `;
  const args = runtime === 'node' ? ['--input-type=module', '-e', script] : ['-e', script];
  const result = await run(runtime, args, { cwd: projectDir });
  if (result.exitCode !== 0 || !result.stdout.includes('OK')) {
    throw new Error(
      `assertImport(${runtime}, ${specifier}) failed:\n` +
        `exit=${result.exitCode}\nstdout=${result.stdout}\nstderr=${result.stderr}`,
    );
  }
}

export async function readFixtureJson<T = unknown>(
  projectDir: string,
  relPath: string,
): Promise<T> {
  return JSON.parse(await readFile(join(projectDir, relPath), 'utf-8')) as T;
}
