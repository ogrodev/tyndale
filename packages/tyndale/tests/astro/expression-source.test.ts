import { describe, expect, it } from 'bun:test';
import { parseAstro } from '../../src/astro/parser';
import { extractTemplateExpressions } from '../../src/astro/expression-source';

describe('extractTemplateExpressions', () => {
  it('returns one entry per template `{…}` expression with source text and 1-indexed startLine', async () => {
    const source = `---
const greeting = 'hi';
---
<Layout>
  {greeting}
  {t('Hello')}
  {1 + 2}
</Layout>
`;
    const file = await parseAstro(source, 'exp.astro');
    const exprs = extractTemplateExpressions(file.templateRoot);

    expect(exprs.map((e) => ({ source: e.source, startLine: e.startLine }))).toEqual([
      { source: 'greeting', startLine: 5 },
      { source: "t('Hello')", startLine: 6 },
      { source: '1 + 2', startLine: 7 },
    ]);
  });

  it('excludes expressions that live inside a <T> element', async () => {
    const source = `---
---
<T>Hello <Var name="user">{user}</Var></T>
<p>{greeting}</p>
`;
    const file = await parseAstro(source, 'exp.astro');
    const exprs = extractTemplateExpressions(file.templateRoot);

    // Only the <p>{greeting}</p> expression should surface.
    expect(exprs).toHaveLength(1);
    expect(exprs[0].source).toBe('greeting');
    expect(exprs[0].startLine).toBe(4);
  });
});
