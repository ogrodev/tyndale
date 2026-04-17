import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractFromAstroFile } from '../../src/extract/astro-extract';

const FIXTURES = join(import.meta.dir, '../fixtures/astro');

async function extractFixture(file: string) {
  const source = readFileSync(join(FIXTURES, file), 'utf-8');
  return extractFromAstroFile(source, file);
}

describe('astro extraction diagnostics — line-number parity', () => {
  it('frontmatter msg() non-literal: error line matches source', async () => {
    const result = await extractFixture('diag-frontmatter.astro');
    expect(result.errors).toHaveLength(1);
    // Fixture has `msg(dynamic)` on source line 5.
    expect(result.errors[0].line).toBe(5);
  });

  it('<T> unwrapped expression: error line matches source', async () => {
    const result = await extractFixture('diag-template-t.astro');
    expect(result.errors).toHaveLength(1);
    // Fixture has <T>Hello {user}</T> on source line 5.
    expect(result.errors[0].line).toBe(5);
  });

  it('template expression t(nonLiteral): error line matches source', async () => {
    const result = await extractFixture('diag-template-expr.astro');
    expect(result.errors).toHaveLength(1);
    // Fixture has {t(unknownBinding)} on source line 6.
    expect(result.errors[0].line).toBe(6);
  });
});
