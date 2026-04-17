/**
 * Extracts raw TypeScript source substrings and 1-indexed source line numbers
 * for every `{…}` expression in an Astro template tree.
 *
 * Expressions inside a `<T>` element are EXCLUDED — the `<T>` serializer owns
 * those and extracting them here would double-process them.
 */
import type { Node, ParentNode, ExpressionNode } from '@astrojs/compiler/types';

export interface TemplateExpression {
  /** Raw TS source of the expression, without the surrounding braces. */
  source: string;
  /** 1-indexed line in the original `.astro` where the expression begins. */
  startLine: number;
}

export function extractTemplateExpressions(root: ParentNode): TemplateExpression[] {
  const results: TemplateExpression[] = [];
  walk(root);
  return results;

  function walk(node: Node): void {
    // Skip subtrees rooted at `<T>`.
    if (isTaggedAs(node, 'T')) return;

    if (node.type === 'expression') {
      const expr = node as ExpressionNode;
      results.push({
        source: sourceFromExpression(expr),
        startLine: expr.position?.start.line ?? 0,
      });
      // Do not recurse into expression children — children are the raw TS text,
      // not nested template expressions.
      return;
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }
}

function isTaggedAs(node: Node, tagName: string): boolean {
  return (
    (node.type === 'element' || node.type === 'component' || node.type === 'custom-element') &&
    (node as { name?: string }).name === tagName
  );
}

function sourceFromExpression(node: ExpressionNode): string {
  // @astrojs/compiler stores the expression's raw TS as TextNode children.
  // Concatenating their `value` fields reconstructs the source between the braces.
  let result = '';
  for (const child of node.children ?? []) {
    if (child.type === 'text' && typeof (child as { value?: string }).value === 'string') {
      result += (child as { value: string }).value;
    }
  }
  return result;
}
