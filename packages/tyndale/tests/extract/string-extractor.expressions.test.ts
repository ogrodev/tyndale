import { describe, expect, it } from 'bun:test';
import {
  extractStringCallsFromExpressions,
  type TBindings,
} from '../../src/extract/string-extractor';
import type { TemplateExpression } from '../../src/astro/expression-source';

describe('extractStringCallsFromExpressions', () => {
  it('extracts string-literal calls on `t` across multiple template expressions', () => {
    const exprs: TemplateExpression[] = [
      { source: "t('Hello')", startLine: 5 },
      { source: "t('World')", startLine: 7 },
      { source: 't(x)', startLine: 9 },
    ];
    const bindings: TBindings = {
      tyndaleImports: new Set(['t']),
      tBindings: new Set(['t']),
    };

    const result = extractStringCallsFromExpressions(exprs, 'file.astro', bindings);

    expect(result.entries.map((e) => e.wireFormat)).toEqual(['Hello', 'World']);
    expect(result.entries.map((e) => e.context)).toEqual([
      'file.astro:t@5',
      'file.astro:t@7',
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(9);
    expect(result.errors[0].message).toContain('non-literal argument to t()');
  });

  it('returns empty result when there are no bindings', () => {
    const exprs: TemplateExpression[] = [{ source: "t('Hello')", startLine: 3 }];
    const bindings: TBindings = { tyndaleImports: new Set(), tBindings: new Set() };
    const result = extractStringCallsFromExpressions(exprs, 'f.astro', bindings);
    expect(result.entries).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
