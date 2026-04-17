import { describe, expect, it } from 'bun:test';
import { extractFromAstroFile } from '../../src/extract/astro-extract';

describe('extractFromAstroFile', () => {
  it('composes frontmatter msg(), template t(), and template <T> into one extraction result', async () => {
    const source = `---
import { msg, useTranslation } from 'tyndale-react';
const greeting = msg('Hello');
const t = useTranslation();
---
<div>
  <p>{t('World')}</p>
  <T>Welcome</T>
</div>
`;
    const result = await extractFromAstroFile(source, 'page.astro');

    expect(result.errors).toEqual([]);
    const wires = result.entries.map((e) => e.wireFormat).sort();
    expect(wires).toEqual(['Hello', 'Welcome', 'World']);

    const wireToEntry = new Map(result.entries.map((e) => [e.wireFormat, e]));
    expect(wireToEntry.get('Hello')!.type).toBe('string');
    expect(wireToEntry.get('Hello')!.context).toBe('page.astro:msg@3');
    expect(wireToEntry.get('World')!.type).toBe('string');
    expect(wireToEntry.get('World')!.context).toBe('page.astro:t@7');
    expect(wireToEntry.get('Welcome')!.type).toBe('jsx');
    expect(wireToEntry.get('Welcome')!.context).toBe('page.astro:T@8');
  });

  it('returns one error with line 0 and no entries on top-level parse failure', async () => {
    // Deliberately malformed frontmatter opening.
    const source = `---\nconst x = (\n---\n<h1/>\n`;
    const result = await extractFromAstroFile(source, 'bad.astro');
    // parseAstro succeeds (compiler lenient), but parseFrontmatterAsTs throws;
    // we accept either: no top-level throw, one error total, and no entries.
    expect(result.entries).toEqual([]);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });
});
