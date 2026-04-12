// packages/tyndale/tests/commands/validate-cli.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function createFixture(dir: string, files: Record<string, string>, config?: object) {
  const cfg = config ?? {
    defaultLocale: 'en',
    locales: ['es'],
    source: ['src'],
    extensions: ['.tsx'],
    output: 'public/_tyndale',
    batchSize: 50,
    localeAliases: {},
    dictionaries: { include: [], format: 'key-value' },
    pi: { model: 'claude-sonnet-4-20250514', thinkingLevel: 'low' },
  };
  await writeFile(join(dir, 'tyndale.config.json'), JSON.stringify(cfg));
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content);
  }
}

describe('tyndale validate (CLI)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tyndale-validate-cli-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('exits 0 for valid project', async () => {
    await createFixture(dir, {
      'src/page.tsx': `
        import { T } from 'tyndale-react';
        export default function Page() {
          return <T><h1>Hello world</h1></T>;
        }
      `,
    });

    const proc = Bun.spawn(
      ['bun', 'run', join(__dirname, '../../src/cli.ts'), 'validate'],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
    );
    expect(await proc.exited).toBe(0);
  });

  it('exits 1 for project with errors', async () => {
    await createFixture(dir, {
      'src/page.tsx': `
        import { T } from 'tyndale-react';
        export default function Page({ name }: { name: string }) {
          return <T><p>Hello {name}</p></T>;
        }
      `,
    });

    const proc = Bun.spawn(
      ['bun', 'run', join(__dirname, '../../src/cli.ts'), 'validate'],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
    );
    expect(await proc.exited).toBe(1);
  });

  it('prints entry count and diagnostics to stdout', async () => {
    await createFixture(dir, {
      'src/page.tsx': `
        import { T } from 'tyndale-react';
        export default function Page() {
          return <T><h1>Hello</h1></T>;
        }
      `,
    });

    const proc = Bun.spawn(
      ['bun', 'run', join(__dirname, '../../src/cli.ts'), 'validate'],
      { cwd: dir, stdout: 'pipe', stderr: 'pipe' },
    );
    await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(stdout).toContain('validated');
    expect(stdout).toContain('0 errors');
  });
});
