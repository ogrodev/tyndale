import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { extractDictionaries } from '../../src/extract/dict-extractor';
import { computeHash } from 'tyndale-react'
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__/dict');

beforeAll(() => {
  mkdirSync(join(FIXTURE_DIR, 'src/dictionaries/pages'), { recursive: true });

  writeFileSync(
    join(FIXTURE_DIR, 'src/dictionaries/common.json'),
    JSON.stringify({
      greeting: 'Hello, welcome!',
      farewell: 'Goodbye!',
    }),
  );

  writeFileSync(
    join(FIXTURE_DIR, 'src/dictionaries/pages/home.json'),
    JSON.stringify({
      title: 'Home Page',
    }),
  );
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe('extractDictionaries', () => {
  it('extracts key-value pairs from dictionary files', async () => {
    const entries = await extractDictionaries({
      include: ['src/dictionaries/*.json'],
      rootDir: FIXTURE_DIR,
    });

    expect(entries).toHaveLength(2);

    const greeting = entries.find((e) => e.dictKey === 'greeting');
    expect(greeting).toBeDefined();
    expect(greeting!.type).toBe('dictionary');
    expect(greeting!.dictFile).toBe('common');
    expect(greeting!.wireFormat).toBe('Hello, welcome!');
    expect(greeting!.hash).toBe(computeHash('dict:common:greeting:Hello, welcome!'));

    const farewell = entries.find((e) => e.dictKey === 'farewell');
    expect(farewell).toBeDefined();
    expect(farewell!.wireFormat).toBe('Goodbye!');
  });

  it('derives filename key from relative path without extension', async () => {
    const entries = await extractDictionaries({
      include: ['src/dictionaries/**/*.json'],
      rootDir: FIXTURE_DIR,
    });

    const homeTitle = entries.find((e) => e.dictKey === 'title');
    expect(homeTitle).toBeDefined();
    expect(homeTitle!.dictFile).toBe('pages/home');
  });

  it('computes hash as sha256("dict:{filenameKey}:{dictKey}:{value}")', async () => {
    const entries = await extractDictionaries({
      include: ['src/dictionaries/*.json'],
      rootDir: FIXTURE_DIR,
    });

    const greeting = entries.find((e) => e.dictKey === 'greeting')!;
    const expectedHash = computeHash('dict:common:greeting:Hello, welcome!');
    expect(greeting.hash).toBe(expectedHash);
  });

  it('returns empty array when no files match glob', async () => {
    const entries = await extractDictionaries({
      include: ['nonexistent/*.json'],
      rootDir: FIXTURE_DIR,
    });

    expect(entries).toEqual([]);
  });

  it('sets context with dictFile and key info', async () => {
    const entries = await extractDictionaries({
      include: ['src/dictionaries/*.json'],
      rootDir: FIXTURE_DIR,
    });

    const greeting = entries.find((e) => e.dictKey === 'greeting')!;
    expect(greeting.context).toBe('dict:common:greeting');
  });
});
