import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { walkSourceFiles } from '../../src/extract/file-walker';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

const FIXTURE_DIR = join(import.meta.dir, '__fixtures__/walker');

beforeAll(() => {
  mkdirSync(join(FIXTURE_DIR, 'src/components'), { recursive: true });
  mkdirSync(join(FIXTURE_DIR, 'src/utils'), { recursive: true });
  mkdirSync(join(FIXTURE_DIR, 'app'), { recursive: true });
  mkdirSync(join(FIXTURE_DIR, 'ignored'), { recursive: true });

  writeFileSync(join(FIXTURE_DIR, 'src/components/Header.tsx'), '// header');
  writeFileSync(join(FIXTURE_DIR, 'src/components/Footer.tsx'), '// footer');
  writeFileSync(join(FIXTURE_DIR, 'src/utils/helpers.ts'), '// helpers');
  writeFileSync(join(FIXTURE_DIR, 'src/utils/styles.css'), '/* css */');
  writeFileSync(join(FIXTURE_DIR, 'app/page.tsx'), '// page');
  writeFileSync(join(FIXTURE_DIR, 'app/layout.js'), '// layout');
  writeFileSync(join(FIXTURE_DIR, 'app/data.json'), '{}');
  writeFileSync(join(FIXTURE_DIR, 'ignored/secret.ts'), '// secret');
});

afterAll(() => {
  rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe('walkSourceFiles', () => {
  it('finds files in configured source directories with matching extensions', async () => {
    const files = await walkSourceFiles({
      source: ['src', 'app'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      rootDir: FIXTURE_DIR,
    });

    const relative = files.map((f) => f.replace(FIXTURE_DIR + '/', '')).sort();

    expect(relative).toEqual([
      'app/layout.js',
      'app/page.tsx',
      'src/components/Footer.tsx',
      'src/components/Header.tsx',
      'src/utils/helpers.ts',
    ]);
  });

  it('excludes files with non-matching extensions', async () => {
    const files = await walkSourceFiles({
      source: ['src'],
      extensions: ['.tsx'],
      rootDir: FIXTURE_DIR,
    });

    const relative = files.map((f) => f.replace(FIXTURE_DIR + '/', '')).sort();

    expect(relative).toEqual([
      'src/components/Footer.tsx',
      'src/components/Header.tsx',
    ]);
  });

  it('does not walk directories outside source config', async () => {
    const files = await walkSourceFiles({
      source: ['src'],
      extensions: ['.ts', '.tsx'],
      rootDir: FIXTURE_DIR,
    });

    const relative = files.map((f) => f.replace(FIXTURE_DIR + '/', ''));
    expect(relative.some((f) => f.startsWith('ignored/'))).toBe(false);
    expect(relative.some((f) => f.startsWith('app/'))).toBe(false);
  });

  it('returns empty array when source dir does not exist', async () => {
    const files = await walkSourceFiles({
      source: ['nonexistent'],
      extensions: ['.ts'],
      rootDir: FIXTURE_DIR,
    });

    expect(files).toEqual([]);
  });
});
