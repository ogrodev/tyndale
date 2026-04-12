import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { writeExtractionOutput } from '../../src/extract/output-writer';
import type { ExtractedEntry } from '../../src/extract/t-extractor';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(import.meta.dir, '__fixtures__/output');

beforeEach(() => {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
});

describe('writeExtractionOutput', () => {
  it('writes manifest.json with correct structure', async () => {
    const entries: ExtractedEntry[] = [
      { hash: 'abc123', wireFormat: '<0>Hello</0>', type: 'jsx', context: 'app/page.tsx:T@5' },
      { hash: 'def456', wireFormat: 'Enter email', type: 'string', context: 'app/form.tsx:t@10' },
    ];

    await writeExtractionOutput({
      entries,
      outputDir: OUTPUT_DIR,
      defaultLocale: 'en',
      locales: ['es', 'fr'],
    });

    const manifest = JSON.parse(readFileSync(join(OUTPUT_DIR, 'manifest.json'), 'utf-8'));

    expect(manifest.version).toBe(1);
    expect(manifest.defaultLocale).toBe('en');
    expect(manifest.locales).toEqual(['es', 'fr']);
    expect(manifest.entries['abc123']).toEqual({ type: 'jsx', context: 'app/page.tsx:T@5' });
    expect(manifest.entries['def456']).toEqual({ type: 'string', context: 'app/form.tsx:t@10' });
  });

  it('writes default locale JSON with hash-to-wireFormat mapping', async () => {
    const entries: ExtractedEntry[] = [
      { hash: 'abc123', wireFormat: '<0>Hello</0>', type: 'jsx', context: 'app/page.tsx:T@5' },
      { hash: 'def456', wireFormat: 'Enter email', type: 'string', context: 'app/form.tsx:t@10' },
    ];

    await writeExtractionOutput({
      entries,
      outputDir: OUTPUT_DIR,
      defaultLocale: 'en',
      locales: ['es'],
    });

    const localeData = JSON.parse(readFileSync(join(OUTPUT_DIR, 'en.json'), 'utf-8'));

    expect(localeData['abc123']).toBe('<0>Hello</0>');
    expect(localeData['def456']).toBe('Enter email');
  });

  it('includes dictionary metadata in manifest', async () => {
    const entries: ExtractedEntry[] = [
      {
        hash: 'dict1',
        wireFormat: 'Hello, welcome!',
        type: 'dictionary',
        context: 'dict:common:greeting',
        dictKey: 'greeting',
        dictFile: 'common',
      },
    ];

    await writeExtractionOutput({
      entries,
      outputDir: OUTPUT_DIR,
      defaultLocale: 'en',
      locales: [],
    });

    const manifest = JSON.parse(readFileSync(join(OUTPUT_DIR, 'manifest.json'), 'utf-8'));

    expect(manifest.entries['dict1']).toEqual({
      type: 'dictionary',
      context: 'dict:common:greeting',
      dictKey: 'greeting',
      dictFile: 'common',
    });
  });

  it('deduplicates entries by hash (last wins)', async () => {
    const entries: ExtractedEntry[] = [
      { hash: 'same', wireFormat: 'Hello', type: 'string', context: 'a.tsx:t@1' },
      { hash: 'same', wireFormat: 'Hello', type: 'string', context: 'b.tsx:t@5' },
    ];

    await writeExtractionOutput({
      entries,
      outputDir: OUTPUT_DIR,
      defaultLocale: 'en',
      locales: [],
    });

    const localeData = JSON.parse(readFileSync(join(OUTPUT_DIR, 'en.json'), 'utf-8'));
    const manifest = JSON.parse(readFileSync(join(OUTPUT_DIR, 'manifest.json'), 'utf-8'));

    // Only one entry per hash in locale file
    expect(Object.keys(localeData)).toHaveLength(1);
    expect(localeData['same']).toBe('Hello');

    // Manifest keeps first context encountered
    expect(Object.keys(manifest.entries)).toHaveLength(1);
  });

  it('creates output directory if it does not exist', async () => {
    const nested = join(OUTPUT_DIR, 'deep/nested/dir');

    await writeExtractionOutput({
      entries: [{ hash: 'x', wireFormat: 'y', type: 'string', context: 'a.ts:t@1' }],
      outputDir: nested,
      defaultLocale: 'en',
      locales: [],
    });

    expect(existsSync(join(nested, 'manifest.json'))).toBe(true);
    expect(existsSync(join(nested, 'en.json'))).toBe(true);

    rmSync(join(OUTPUT_DIR, 'deep'), { recursive: true, force: true });
  });
});
