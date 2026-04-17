import { describe, expect, it } from 'bun:test';
import traverse from '@babel/traverse';
import { parseAstro, parseFrontmatterAsTs } from '../../src/astro/parser';

// Older Babel CJS default exports need unwrapping under ESM consumers.
const traverseFn = (traverse as unknown as { default?: typeof traverse }).default ?? traverse;

describe('parseAstro', () => {
  it('returns frontmatter source and correct line offsets for a file with frontmatter', async () => {
    const source = `---
const greeting = 'Hello';
const count = 1;
---
<h1>Hi</h1>
`;
    const file = await parseAstro(source, 'test.astro');

    // Frontmatter body excludes the --- fences; its first line is line 2 of the source.
    expect(file.frontmatter.trim()).toContain("const greeting = 'Hello';");
    expect(file.frontmatter.trim()).toContain('const count = 1;');
    expect(file.frontmatterStartLine).toBe(2);
    expect(file.frontmatterEndLine).toBe(4);
    expect(file.templateStartLine).toBe(5);
    expect(file.templateRoot.type).toBe('root');
    // Template root children must not include the frontmatter node.
    expect(file.templateRoot.children.some((c) => c.type === 'frontmatter')).toBe(false);
  });

  it('reports frontmatter === "" and matching line offsets when the file has no frontmatter', async () => {
    const source = '<h1>Hi</h1>\n';
    const file = await parseAstro(source, 'test.astro');

    expect(file.frontmatter).toBe('');
    expect(file.frontmatterStartLine).toBe(1);
    expect(file.templateStartLine).toBe(1);
    expect(file.templateRoot.type).toBe('root');
  });

  it('reuses the cached compiler import across calls (second call is fast)', async () => {
    // Warm up first
    await parseAstro('<h1/>\n', 'a.astro');
    const t0 = performance.now();
    await parseAstro('<h2/>\n', 'b.astro');
    const elapsed = performance.now() - t0;
    // WASM init would be tens of ms; a cached call should be well under 50ms.
    expect(elapsed).toBeLessThan(50);
  });
});

describe('parseFrontmatterAsTs line parity', () => {
  it('maps CallExpression loc.start.line to the original .astro source line', async () => {
    const source = `---
const x = 1;
const y = msg('x');
---
<div/>
`;
    const file = await parseAstro(source, 'fm.astro');
    const ast = parseFrontmatterAsTs(file.frontmatter, 'fm.astro', file.frontmatterStartLine);

    let msgLine: number | null = null;
    traverseFn(ast, {
      CallExpression(path: any) {
        const callee = path.node.callee;
        if (callee.type === 'Identifier' && callee.name === 'msg') {
          msgLine = path.node.loc?.start.line ?? null;
        }
      },
    });

    expect(msgLine).toBe(3);
  });
});
