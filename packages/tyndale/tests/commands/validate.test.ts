// packages/tyndale/tests/commands/validate.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runValidate } from '../../src/commands/validate';

// Helper to create a fixture project
async function createFixture(
  dir: string,
  opts: {
    config?: object;
    files?: Record<string, string>;
  },
) {
  const config = opts.config ?? {
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
  await writeFile(join(dir, 'tyndale.config.json'), JSON.stringify(config));

  for (const [path, content] of Object.entries(opts.files ?? {})) {
    const fullPath = join(dir, path);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content);
  }
}

describe('runValidate', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tyndale-validate-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns exit code 0 for a clean project', async () => {
    await createFixture(dir, {
      files: {
        'src/page.tsx': `
          import { T } from 'tyndale-react';
          export default function Page() {
            return <T><h1>Hello world</h1></T>;
          }
        `,
      },
    });

    const result = await runValidate(dir);
    expect(result.exitCode).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns exit code 1 for validation errors (unwrapped dynamic content)', async () => {
    await createFixture(dir, {
      files: {
        'src/page.tsx': `
          import { T } from 'tyndale-react';
          export default function Page({ name }: { name: string }) {
            return <T><p>Hello {name}</p></T>;
          }
        `,
      },
    });

    const result = await runValidate(dir);
    expect(result.exitCode).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('dynamic content');
  });

  it('returns exit code 1 for non-literal t() argument', async () => {
    await createFixture(dir, {
      files: {
        'src/page.tsx': `
          import { useTranslation } from 'tyndale-react';
          export default function Page({ key }: { key: string }) {
            const t = useTranslation();
            return <p>{t(key)}</p>;
          }
        `,
      },
    });

    const result = await runValidate(dir);
    expect(result.exitCode).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('literal');
  });

  it('returns exit code 0 with warnings (warnings do not block)', async () => {
    // Stale translations produce warnings, not errors.
    await createFixture(dir, {
      files: {
        'src/page.tsx': `
          import { T } from 'tyndale-react';
          export default function Page() {
            return <T><h1>Hello world</h1></T>;
          }
        `,
      },
    });
    // Simulate stale hash in existing locale file
    await mkdir(join(dir, 'public/_tyndale'), { recursive: true });
    await writeFile(
      join(dir, 'public/_tyndale/es.json'),
      JSON.stringify({ stale_hash_abc123: 'Hola mundo viejo' }),
    );

    const result = await runValidate(dir);
    expect(result.exitCode).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].message).toContain('stale');
  });

  it('does not write any files', async () => {
    await createFixture(dir, {
      files: {
        'src/page.tsx': `
          import { T } from 'tyndale-react';
          export default function Page() {
            return <T><h1>Hello</h1></T>;
          }
        `,
      },
    });

    const { readdir } = await import('node:fs/promises');

    // Snapshot output dir state before
    let outputDirBefore: string[] = [];
    try {
      outputDirBefore = await readdir(join(dir, 'public/_tyndale'));
    } catch {}

    await runValidate(dir);

    // Output dir state unchanged
    let outputDirAfter: string[] = [];
    try {
      outputDirAfter = await readdir(join(dir, 'public/_tyndale'));
    } catch {}

    expect(outputDirAfter).toEqual(outputDirBefore);
  });

  it('exits 1 when config file is missing', async () => {
    // No config file, no source files — just an empty dir
    const result = await runValidate(dir);
    expect(result.exitCode).toBe(1);
    expect(result.errors[0].message).toContain('tyndale.config.json');
  });
});
