import { describe, expect, it } from 'bun:test';
import { splitAstroFast } from '../../src/astro/split-fast';

describe('splitAstroFast', () => {
  it('returns ok with frontmatter and body for a valid .astro file', () => {
    const result = splitAstroFast('---\nconst x=1;\n---\n<h1/>\n');
    expect(result).toEqual({
      kind: 'ok',
      frontmatter: 'const x=1;',
      body: '<h1/>\n',
    });
  });

  it('returns no-frontmatter when there is no --- fence at all', () => {
    const result = splitAstroFast('<h1/>');
    expect(result).toEqual({
      kind: 'no-frontmatter',
      body: '<h1/>',
    });
  });

  it('returns invalid-prelude when content precedes the opening fence', () => {
    const result = splitAstroFast('\n\nmaybe\n---\nconst x=1;\n---');
    expect(result).toEqual({ kind: 'invalid-prelude' });
  });

  it('returns unclosed-frontmatter when the opening fence has no closer', () => {
    const result = splitAstroFast('---\nconst x=1;\n');
    expect(result).toEqual({ kind: 'unclosed-frontmatter' });
  });

  it('strips a leading BOM before scanning', () => {
    const result = splitAstroFast('\uFEFF---\nx\n---\n');
    expect(result).toEqual({ kind: 'ok', frontmatter: 'x', body: '' });
  });

  it('normalizes CRLF line endings', () => {
    const result = splitAstroFast('---\r\nx\r\n---\r\n');
    expect(result).toEqual({ kind: 'ok', frontmatter: 'x', body: '' });
  });

  it('preserves body content after the closing fence verbatim (LF)', () => {
    const result = splitAstroFast('---\nlet y = 2;\n---\n<h1>Hi</h1>\n<p>Body</p>\n');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.frontmatter).toBe('let y = 2;');
      expect(result.body).toBe('<h1>Hi</h1>\n<p>Body</p>\n');
    }
  });

  it('handles multi-line frontmatter with blank lines', () => {
    const source = '---\nimport X from "a";\n\nconst y = 1;\n---\n<h1/>\n';
    const result = splitAstroFast(source);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.frontmatter).toBe('import X from "a";\n\nconst y = 1;');
      expect(result.body).toBe('<h1/>\n');
    }
  });
});
