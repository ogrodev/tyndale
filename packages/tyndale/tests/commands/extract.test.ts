import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { runExtract } from '../../src/commands/extract';
import { readFileSync, rmSync, existsSync, cpSync } from 'fs';
import { join } from 'path';

const FIXTURE_SRC = join(import.meta.dir, '__fixtures__/project');
const WORK_DIR = join(import.meta.dir, '__work__/extract-test');

beforeEach(() => {
  rmSync(WORK_DIR, { recursive: true, force: true });
  cpSync(FIXTURE_SRC, WORK_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(WORK_DIR, { recursive: true, force: true });
});

describe('runExtract (integration)', () => {
  it('extracts all entry types and writes correct output', async () => {
    const result = await runExtract({}, WORK_DIR);

    expect(result.exitCode).toBe(0);

    const outputDir = join(WORK_DIR, 'public/_tyndale');
    expect(existsSync(join(outputDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(outputDir, 'en.json'))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf-8'));
    const localeData = JSON.parse(readFileSync(join(outputDir, 'en.json'), 'utf-8'));

    // Verify manifest structure
    expect(manifest.version).toBe(1);
    expect(manifest.defaultLocale).toBe('en');
    expect(manifest.locales).toEqual(['es', 'fr']);

    // Count entries: 2 T components + 2 t() + 2 msg() + 2 dict = 8
    const entryCount = Object.keys(manifest.entries).length;
    expect(entryCount).toBe(8);

    // Verify entry types
    const entries = Object.values(manifest.entries) as any[];
    const jsxEntries = entries.filter((e) => e.type === 'jsx');
    const stringEntries = entries.filter((e) => e.type === 'string');
    const dictEntries = entries.filter((e) => e.type === 'dictionary');

    expect(jsxEntries).toHaveLength(2);
    expect(stringEntries).toHaveLength(4); // 2 t() + 2 msg()
    expect(dictEntries).toHaveLength(2);

    // Verify dictionary metadata
    const dictEntry = dictEntries.find((e: any) => e.dictKey === 'greeting');
    expect(dictEntry).toBeDefined();
    expect(dictEntry.dictFile).toBe('common');

    // Verify locale data has same keys as manifest
    const manifestHashes = Object.keys(manifest.entries).sort();
    const localeHashes = Object.keys(localeData).sort();
    expect(localeHashes).toEqual(manifestHashes);

    // Verify specific wire formats
    const jsxValues = Object.values(localeData) as string[];
    expect(jsxValues).toContain('<0>Welcome to <1>our app</1></0><2>Start building.</2>');
    expect(jsxValues).toContain('<0>Hello {user}</0>');
    expect(jsxValues).toContain('Enter your email');
    expect(jsxValues).toContain('Email address');
    expect(jsxValues).toContain('Home');
    expect(jsxValues).toContain('About');
    expect(jsxValues).toContain('Hello, welcome!');
    expect(jsxValues).toContain('Goodbye!');
  });

  it('detects validation errors in bad source files', async () => {
    // Add a file with unwrapped dynamic content
    const badFile = join(WORK_DIR, 'src/bad.tsx');
    const Bun = globalThis.Bun;
    await Bun.write(badFile, `
      import { T } from 'tyndale-react';
      export function Bad({ name }: { name: string }) {
        return <T><p>Hello {name}</p></T>;
      }
    `);

    const result = await runExtract({}, WORK_DIR);

    // Should still write output but exit with error
    expect(result.exitCode).toBe(1);

    // Output is still written (extraction continues despite validation errors)
    const outputDir = join(WORK_DIR, 'public/_tyndale');
    expect(existsSync(join(outputDir, 'manifest.json'))).toBe(true);
  });

  it('handles project with no translatable content', async () => {
    // Remove all source files
    rmSync(join(WORK_DIR, 'src'), { recursive: true, force: true });
    const { mkdirSync } = await import('fs');
    mkdirSync(join(WORK_DIR, 'src'), { recursive: true });

    const result = await runExtract({}, WORK_DIR);
    expect(result.exitCode).toBe(0);

    const outputDir = join(WORK_DIR, 'public/_tyndale');
    const manifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf-8'));
    expect(Object.keys(manifest.entries)).toHaveLength(0);
  });
});
