import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { detectDocFrameworks } from '../../src/docs/detect';

describe('detectDocFrameworks', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(import.meta.dir, '__fixtures__/detect-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('detects Starlight with high confidence when dep + config present', () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ devDependencies: { '@astrojs/starlight': '*' } }),
    );
    writeFileSync(join(testDir, 'astro.config.mjs'), '');

    const results = detectDocFrameworks(testDir);
    const starlight = results.find((r) => r.framework.id === 'starlight');

    expect(starlight).toBeDefined();
    expect(starlight!.confidence).toBe('high');
    expect(starlight!.contentDir).toBe('src/content/docs');
  });

  it('detects Docusaurus with high confidence when dep + config present', () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ dependencies: { '@docusaurus/core': '*' } }),
    );
    writeFileSync(join(testDir, 'docusaurus.config.js'), '');

    const results = detectDocFrameworks(testDir);
    const docusaurus = results.find((r) => r.framework.id === 'docusaurus');

    expect(docusaurus).toBeDefined();
    expect(docusaurus!.confidence).toBe('high');
    expect(docusaurus!.contentDir).toBe('docs');
  });

  it('detects VitePress with medium confidence when dep present but no config', () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ devDependencies: { vitepress: '*' } }),
    );
    // No .vitepress/config.ts created

    const results = detectDocFrameworks(testDir);
    const vitepress = results.find((r) => r.framework.id === 'vitepress');

    expect(vitepress).toBeDefined();
    expect(vitepress!.confidence).toBe('medium');
  });

  it('detects MkDocs with high confidence from config file alone', () => {
    // No package.json — MkDocs is not a Node framework
    writeFileSync(join(testDir, 'mkdocs.yml'), '');

    const results = detectDocFrameworks(testDir);
    const mkdocs = results.find((r) => r.framework.id === 'mkdocs');

    expect(mkdocs).toBeDefined();
    expect(mkdocs!.confidence).toBe('high');
  });

  it('detects Nextra with high confidence when dep + config present', () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ dependencies: { nextra: '*' } }),
    );
    writeFileSync(join(testDir, 'next.config.mjs'), '');

    const results = detectDocFrameworks(testDir);
    const nextra = results.find((r) => r.framework.id === 'nextra');

    expect(nextra).toBeDefined();
    expect(nextra!.confidence).toBe('high');
    expect(nextra!.contentDir).toBe('pages');
  });

  it('returns empty array for an empty directory', () => {
    const results = detectDocFrameworks(testDir);
    expect(results).toEqual([]);
  });

  it('detects multiple frameworks when signals for both exist', () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        devDependencies: { '@astrojs/starlight': '*' },
        dependencies: { '@docusaurus/core': '*' },
      }),
    );
    writeFileSync(join(testDir, 'astro.config.mjs'), '');
    writeFileSync(join(testDir, 'docusaurus.config.js'), '');

    const results = detectDocFrameworks(testDir);
    const ids = results.map((r) => r.framework.id);

    expect(ids).toContain('starlight');
    expect(ids).toContain('docusaurus');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when package.json is malformed', () => {
    writeFileSync(join(testDir, 'package.json'), '{ invalid json');

    const results = detectDocFrameworks(testDir);
    expect(results).toEqual([]);
  });
});
