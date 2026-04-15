import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDocsProvider } from '../../src/docs/providers/index';
import { StarlightProvider } from '../../src/docs/providers/starlight';
import { DocusaurusProvider } from '../../src/docs/providers/docusaurus';
import { VitePressProvider } from '../../src/docs/providers/vitepress';
import { MkDocsProvider } from '../../src/docs/providers/mkdocs';
import { NextraProvider } from '../../src/docs/providers/nextra';
import type { DocsFrameworkId } from '../../src/docs/types';

describe('getDocsProvider registry', () => {
  const frameworkIds: DocsFrameworkId[] = ['starlight', 'docusaurus', 'vitepress', 'mkdocs', 'nextra'];

  it('returns a provider with matching framework.id for each framework', () => {
    for (const id of frameworkIds) {
      const provider = getDocsProvider(id);
      expect(provider).toBeDefined();
      expect(provider.framework.id).toBe(id);
    }
  });

  it('getDocsProvider("starlight") returns a provider with framework.id === "starlight"', () => {
    const provider = getDocsProvider('starlight');
    expect(provider.framework.id).toBe('starlight');
  });
});

describe('StarlightProvider', () => {
  const provider = new StarlightProvider();

  it('has correct extensions', () => {
    expect(provider.extensions).toEqual(['.mdx', '.md']);
  });

  it('resolveTargetPath inserts locale as top-level directory', () => {
    const result = provider.resolveTargetPath(
      '/proj/docs/guide/intro.mdx',
      '/proj/docs',
      'es',
    );
    expect(result).toBe('/proj/docs/es/guide/intro.mdx');
  });

  describe('findSourceFiles', () => {
    const tmpDir = join(import.meta.dir, '__fixtures__/starlight-find');

    beforeEach(() => {
      mkdirSync(join(tmpDir, 'guide'), { recursive: true });
      mkdirSync(join(tmpDir, 'es/guide'), { recursive: true });
      writeFileSync(join(tmpDir, 'guide/intro.mdx'), '# Intro');
      writeFileSync(join(tmpDir, 'es/guide/intro.mdx'), '# Intro ES');
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('excludes files in locale directories', () => {
      const files = provider.findSourceFiles(tmpDir, ['es']);
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(join(tmpDir, 'guide/intro.mdx'));
    });
  });
});

describe('DocusaurusProvider', () => {
  const provider = new DocusaurusProvider();

  it('has correct extensions', () => {
    expect(provider.extensions).toEqual(['.mdx', '.md']);
  });

  it('resolveTargetPath uses i18n directory structure', () => {
    const result = provider.resolveTargetPath(
      '/proj/docs/guide/intro.md',
      '/proj/docs',
      'fr',
    );
    expect(result).toBe('/proj/i18n/fr/docusaurus-plugin-content-docs/current/guide/intro.md');
  });
});

describe('VitePressProvider', () => {
  const provider = new VitePressProvider();

  it('has correct extensions', () => {
    expect(provider.extensions).toEqual(['.md']);
  });

  it('resolveTargetPath inserts locale as top-level directory', () => {
    const result = provider.resolveTargetPath(
      '/proj/docs/guide/intro.md',
      '/proj/docs',
      'zh',
    );
    expect(result).toBe('/proj/docs/zh/guide/intro.md');
  });
});

describe('MkDocsProvider', () => {
  const provider = new MkDocsProvider();

  it('has correct extensions', () => {
    expect(provider.extensions).toEqual(['.md']);
  });

  it('resolveTargetPath inserts locale as top-level directory', () => {
    const result = provider.resolveTargetPath(
      '/proj/docs/setup.md',
      '/proj/docs',
      'de',
    );
    expect(result).toBe('/proj/docs/de/setup.md');
  });
});

describe('NextraProvider', () => {
  const provider = new NextraProvider();

  it('has correct extensions', () => {
    expect(provider.extensions).toEqual(['.mdx', '.md']);
  });

  it('resolveTargetPath inserts locale suffix before extension (.mdx)', () => {
    const result = provider.resolveTargetPath(
      '/proj/pages/docs/intro.mdx',
      '/proj/pages',
      'ja',
    );
    expect(result).toBe('/proj/pages/docs/intro.ja.mdx');
  });

  it('resolveTargetPath inserts locale suffix before extension (.md)', () => {
    const result = provider.resolveTargetPath(
      '/proj/pages/index.md',
      '/proj/pages',
      'ko',
    );
    expect(result).toBe('/proj/pages/index.ko.md');
  });

  describe('findSourceFiles', () => {
    const tmpDir = join(import.meta.dir, '__fixtures__/nextra-find');

    beforeEach(() => {
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(join(tmpDir, 'intro.mdx'), '# Intro');
      writeFileSync(join(tmpDir, 'intro.fr.mdx'), '# Intro FR');
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('excludes files with locale suffix', () => {
      const files = provider.findSourceFiles(tmpDir, ['fr']);
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(join(tmpDir, 'intro.mdx'));
    });
  });
});
