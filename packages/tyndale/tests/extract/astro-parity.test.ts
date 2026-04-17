import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractFromAstroFile } from '../../src/extract/astro-extract';
import { parseSource } from '../../src/extract/ast-parser';
import { extractTComponents } from '../../src/extract/t-extractor';

const FIXTURES = join(import.meta.dir, '../fixtures/astro');

describe('astro vs tsx wire-format parity', () => {
  it('produces byte-identical wireFormat and hash for the same <T> tree', async () => {
    const astroSource = readFileSync(join(FIXTURES, 'parity.astro'), 'utf-8');
    const tsxSource = readFileSync(join(FIXTURES, 'parity.tsx'), 'utf-8');

    const astroResult = await extractFromAstroFile(astroSource, 'parity.astro');
    const tsxAst = parseSource(tsxSource, 'parity.tsx');
    const tsxEntries = extractTComponents(tsxAst, 'parity.tsx');

    const astroT = astroResult.entries.find((e) => e.type === 'jsx');
    const tsxT = tsxEntries[0];

    expect(astroT).toBeDefined();
    expect(tsxT).toBeDefined();
    expect(astroT!.wireFormat).toBe(tsxT.wireFormat);
    expect(astroT!.hash).toBe(tsxT.hash);
  });
});
