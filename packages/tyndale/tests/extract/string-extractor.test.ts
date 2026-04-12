import { describe, it, expect } from 'bun:test';
import { extractStrings } from '../../src/extract/string-extractor';
import { parseSource } from '../../src/extract/ast-parser';

describe('extractStrings', () => {
  it('extracts t() calls with string literals', () => {
    const code = `
      import { useTranslation } from 'tyndale-react';
      function Form() {
        const t = useTranslation();
        return <input placeholder={t('Enter email')} />;
      }
    `;
    const ast = parseSource(code, 'form.tsx');
    const result = extractStrings(ast, 'form.tsx');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].wireFormat).toBe('Enter email');
    expect(result.entries[0].type).toBe('string');
    expect(result.entries[0].context).toMatch(/form\.tsx:t@5/);
  });

  it('extracts multiple t() calls', () => {
    const code = `
      import { useTranslation } from 'tyndale-react';
      function Form() {
        const t = useTranslation();
        return (
          <div>
            <input placeholder={t('Enter email')} />
            <label>{t('Email address')}</label>
          </div>
        );
      }
    `;
    const ast = parseSource(code, 'form.tsx');
    const result = extractStrings(ast, 'form.tsx');

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].wireFormat).toBe('Enter email');
    expect(result.entries[1].wireFormat).toBe('Email address');
  });

  it('extracts getTranslation() destructured t() calls', () => {
    const code = `
      import { getTranslation } from 'tyndale-react';
      async function Page() {
        const t = await getTranslation();
        return <h1>{t('Page title')}</h1>;
      }
    `;
    const ast = parseSource(code, 'page.tsx');
    const result = extractStrings(ast, 'page.tsx');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].wireFormat).toBe('Page title');
  });

  it('extracts msg() calls', () => {
    const code = `
      import { msg } from 'tyndale-react';
      const NAV_ITEMS = [
        { label: msg('Home'), href: '/' },
        { label: msg('About'), href: '/about' },
      ];
    `;
    const ast = parseSource(code, 'nav.ts');
    const result = extractStrings(ast, 'nav.ts');

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].wireFormat).toBe('Home');
    expect(result.entries[1].wireFormat).toBe('About');
    expect(result.entries[0].context).toMatch(/nav\.ts:msg@4/);
  });

  it('reports error for template literal in t()', () => {
    const code = `
      import { useTranslation } from 'tyndale-react';
      function Form({ type }) {
        const t = useTranslation();
        return <label>{t(\`Enter your \${type}\`)}</label>;
      }
    `;
    const ast = parseSource(code, 'form.tsx');
    const result = extractStrings(ast, 'form.tsx');

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('non-literal');
  });

  it('reports error for variable in t()', () => {
    const code = `
      import { useTranslation } from 'tyndale-react';
      function Form() {
        const t = useTranslation();
        const label = 'hello';
        return <label>{t(label)}</label>;
      }
    `;
    const ast = parseSource(code, 'form.tsx');
    const result = extractStrings(ast, 'form.tsx');

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('non-literal');
  });

  it('reports error for non-literal in msg()', () => {
    const code = `
      import { msg } from 'tyndale-react';
      const x = msg(someVar);
    `;
    const ast = parseSource(code, 'nav.ts');
    const result = extractStrings(ast, 'nav.ts');

    expect(result.entries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('non-literal');
  });

  it('does not extract random t() calls not from tyndale', () => {
    const code = `
      function test() {
        const t = (x: string) => x;
        return t('not extracted');
      }
    `;
    const ast = parseSource(code, 'util.ts');
    const result = extractStrings(ast, 'util.ts');

    // We heuristically extract t() — checking that it comes from
    // useTranslation/getTranslation is done by tracking the binding.
    // Without tyndale imports, we skip.
    expect(result.entries).toHaveLength(0);
  });

  it('deduplicates identical strings by hash', () => {
    const code = `
      import { useTranslation } from 'tyndale-react';
      function A() {
        const t = useTranslation();
        return <div>{t('Submit')}{t('Submit')}</div>;
      }
    `;
    const ast = parseSource(code, 'a.tsx');
    const result = extractStrings(ast, 'a.tsx');

    // Both calls produce entries; deduplication by hash happens at the
    // output-writer level. The extractor reports all occurrences.
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].hash).toBe(result.entries[1].hash);
  });
});
