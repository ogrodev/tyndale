import type { JSXElement, JSXFragment } from '@babel/types';
import type { ExtractionError } from './string-extractor';

type JSXChild = JSXElement['children'][number];

/** Variable components that are allowed to contain dynamic expressions. */
const VARIABLE_COMPONENTS = new Set(['Var', 'Num', 'Currency', 'DateTime', 'Plural']);

/**
 * Validates that a `<T>` component does not contain unwrapped dynamic content.
 * Dynamic expressions (JSXExpressionContainer with non-literal content) must be
 * wrapped in a variable component (<Var>, <Num>, <Currency>, <DateTime>, <Plural>).
 */
export function validateTComponent(tElement: JSXElement, filePath: string): ExtractionError[] {
  const errors: ExtractionError[] = [];
  validateChildren(tElement.children, filePath, errors, false);
  return errors;
}

function validateChildren(
  children: JSXChild[],
  filePath: string,
  errors: ExtractionError[],
  insideVariableComponent: boolean,
): void {
  for (const child of children) {
    switch (child.type) {
      case 'JSXExpressionContainer': {
        if (insideVariableComponent) break;

        const expr = child.expression;
        // String literals are fine — they're static text
        if (expr.type === 'StringLiteral' || expr.type === 'NumericLiteral') break;
        // JSXEmptyExpression (the expression in {/* comment */}) is fine
        if (expr.type === 'JSXEmptyExpression') break;

        const line = child.loc?.start.line ?? 0;
        errors.push({
          file: filePath,
          line,
          message: `Unwrapped dynamic content inside <T> at line ${line}. Wrap in <Var>, <Num>, <Currency>, <DateTime>, or <Plural>.`,
          severity: 'error',
        });
        break;
      }

      case 'JSXElement': {
        const name = child.openingElement.name;
        const tagName = name.type === 'JSXIdentifier' ? name.name : '';

        if (VARIABLE_COMPONENTS.has(tagName)) {
          // Inside a variable component, expressions are allowed
          validateChildren(child.children, filePath, errors, true);
        } else {
          // Regular HTML element — recurse, still checking for unwrapped content
          validateChildren(child.children, filePath, errors, insideVariableComponent);
        }
        break;
      }

      case 'JSXFragment':
        validateChildren(child.children, filePath, errors, insideVariableComponent);
        break;

      // JSXText and JSXSpreadChild — no action needed
      default:
        break;
    }
  }
}

/**
 * Detects stale hashes — entries present in existing locale files but no longer
 * in the current extraction manifest.
 */
export function detectStaleHashes(
  currentHashes: Set<string>,
  existingLocaleData: Record<string, string>,
  localeFile: string,
): ExtractionError[] {
  const warnings: ExtractionError[] = [];

  for (const hash of Object.keys(existingLocaleData)) {
    if (!currentHashes.has(hash)) {
      warnings.push({
        file: localeFile,
        line: 0,
        message: `Stale translation hash "${hash}" in ${localeFile} — no longer referenced in source.`,
        severity: 'warning',
      });
    }
  }

  return warnings;
}
