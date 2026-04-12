// packages/tyndale-next/tests/server-provider.test.tsx
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadLocaleData, loadManifest } from '../src/server-provider';

// We test the data-loading functions directly since the server component
// itself requires a React server component runtime that's hard to unit test.
// Integration tests (Phase 7) cover the full rendering path.

describe('loadLocaleData', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tyndale-server-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads locale JSON from filesystem', () => {
    const outputDir = path.join(tmpDir, 'public', '_tyndale');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, 'es.json'),
      JSON.stringify({ abc123: 'Hola mundo' }),
    );

    const data = loadLocaleData('es', outputDir);
    expect(data).toEqual({ abc123: 'Hola mundo' });
  });

  test('returns empty object if locale file does not exist', () => {
    const outputDir = path.join(tmpDir, 'public', '_tyndale');
    fs.mkdirSync(outputDir, { recursive: true });

    const data = loadLocaleData('missing', outputDir);
    expect(data).toEqual({});
  });

  test('returns empty object if locale file has invalid JSON', () => {
    const outputDir = path.join(tmpDir, 'public', '_tyndale');
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'broken.json'), '{{{invalid');

    const data = loadLocaleData('broken', outputDir);
    expect(data).toEqual({});
  });
});

describe('loadManifest', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tyndale-manifest-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loads manifest.json from filesystem', () => {
    const outputDir = path.join(tmpDir, 'public', '_tyndale');
    fs.mkdirSync(outputDir, { recursive: true });
    const manifest = {
      version: 1,
      defaultLocale: 'en',
      locales: ['es'],
      entries: { abc123: { type: 'jsx', context: 'app/page.tsx:T@5' } },
    };
    fs.writeFileSync(
      path.join(outputDir, 'manifest.json'),
      JSON.stringify(manifest),
    );

    const data = loadManifest(outputDir);
    expect(data).toEqual(manifest);
  });

  test('returns null if manifest does not exist', () => {
    const outputDir = path.join(tmpDir, 'public', '_tyndale');
    fs.mkdirSync(outputDir, { recursive: true });

    const data = loadManifest(outputDir);
    expect(data).toBeNull();
  });
});
