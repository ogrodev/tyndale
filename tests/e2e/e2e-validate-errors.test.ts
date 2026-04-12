import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { rm, cp, mkdtemp, writeFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIXTURE_DIR = join(__dirname, 'fixture');
const CLI_PATH = join(__dirname, '../../packages/tyndale/src/cli.ts');

/** Run the validate CLI command, returning exit code + combined output. */
async function runValidate(cwd: string) {
  const proc = Bun.spawn(['bun', 'run', CLI_PATH, 'validate'], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  return { exitCode, stdout, stderr, output: stdout + stderr };
}

const BAD_FILE_PATH = 'app/bad-page.tsx';

/**
 * Source file with two distinct validation errors:
 * 1. Unwrapped dynamic content inside <T> — {someVariable} without <Var>
 * 2. Non-literal argument to t() — template literal instead of string literal
 */
const BAD_SOURCE = `
import { T, useTranslation } from 'tyndale-react';

export default function BadPage({ name }: { name: string }) {
  const t = useTranslation();

  return (
    <div>
      <T><p>Hello {name}</p></T>
      <span>{t(\`hello \${name}\`)}</span>
    </div>
  );
}
`;

describe('E2E: validate error detection and recovery', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'tyndale-e2e-validate-'));
    await cp(FIXTURE_DIR, workDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('validate passes on the clean fixture', async () => {
    const { exitCode } = await runValidate(workDir);
    expect(exitCode).toBe(0);
  });

  it('validates errors on bad source and recovers after removal', async () => {
    // 1. Inject the bad file
    const badPath = join(workDir, BAD_FILE_PATH);
    await mkdir(join(badPath, '..'), { recursive: true });
    await writeFile(badPath, BAD_SOURCE);

    // 2. Validate must fail with specific error messages
    const fail = await runValidate(workDir);

    // Must fail — not crash, not pass
    expect(fail.exitCode).toBe(1);

    // Errors should reference the problematic file
    expect(fail.output).toContain('bad-page.tsx');

    // Should report unwrapped dynamic content error
    expect(fail.output).toMatch(/dynamic content/i);

    // Should report non-literal t() argument error
    expect(fail.output).toMatch(/literal/i);

    // 3. Remove the bad file
    await unlink(badPath);

    // 4. Validate must pass again
    const recovered = await runValidate(workDir);
    expect(recovered.exitCode).toBe(0);
  });
});
