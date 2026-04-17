import { describe, expect, it } from 'bun:test';
import { computeHash } from 'tyndale-react';
import { parseAstro } from '../../src/astro/parser';
import { extractTFromAstro } from '../../src/extract/t-extractor';

describe('extractTFromAstro', () => {
  it('extracts a single <T> with text content as a jsx entry', async () => {
    const source = `---
---
<T>Hello world</T>
`;
    const file = await parseAstro(source, 'x.astro');
    const entries = extractTFromAstro(file.templateRoot, 'x.astro');

    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('jsx');
    expect(entries[0].wireFormat).toBe('Hello world');
    expect(entries[0].hash).toBe(computeHash('Hello world'));
    expect(entries[0].context).toBe('x.astro:T@3');
  });

  it('emits one entry per sibling <T> in source order', async () => {
    const source = `---
---
<T>First</T>
<T>Second</T>
`;
    const file = await parseAstro(source, 'sib.astro');
    const entries = extractTFromAstro(file.templateRoot, 'sib.astro');

    expect(entries.map((e) => e.wireFormat)).toEqual(['First', 'Second']);
    expect(entries[0].context).toBe('sib.astro:T@3');
    expect(entries[1].context).toBe('sib.astro:T@4');
  });

  it('does not recurse into nested <T> (outer only)', async () => {
    const source = `---
---
<T>Outer <T>Inner</T> end</T>
`;
    const file = await parseAstro(source, 'nest.astro');
    const entries = extractTFromAstro(file.templateRoot, 'nest.astro');

    expect(entries).toHaveLength(1);
    expect(entries[0].wireFormat).toContain('Outer');
    // Inner <T> text becomes an indexed wrapper: `Outer <0>Inner</0> end`
    expect(entries[0].wireFormat).toBe('Outer <0>Inner</0> end');
  });
});
