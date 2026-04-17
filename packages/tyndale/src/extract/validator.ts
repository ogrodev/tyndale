import type { JSXElement, JSXFragment } from '@babel/types';
import type { ExtractionError } from './string-extractor';

type JSXChild = JSXElement['children'][number];

/** Tags reserved by Tyndale: either variable-binding sites or semantic wrappers that bypass literal-text validation inside `<T>`. */
const RESERVED_TYNDALE_TAGS = new Set(['Var', 'Num', 'Currency', 'DateTime', 'Plural']);

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

        if (RESERVED_TYNDALE_TAGS.has(tagName)) {
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

/**
 * Astro-side counterpart to `validateTComponent`. Walks an Astro template AST
 * rooted at a `<T>` element (or the file root) and produces the same error
 * semantics as the JSX validator: unwrapped dynamic expressions inside `<T>`,
 * unsupported children (`<slot>`, `<Fragment>`, `<style>`, `<script>`), and
 * malformed variable/plural components.
 */
import type { Node, ParentNode, TagLikeNode, AttributeNode } from '@astrojs/compiler/types';

export function validateTFromAstro(templateRoot: ParentNode, filePath: string): ExtractionError[] {
  const errors: ExtractionError[] = [];
  walkRoot(templateRoot);
  return errors;

  function walkRoot(node: Node): void {
    if (isTag(node, 'T')) {
      walkT(node as TagLikeNode, false);
      return;
    }
    forEachChild(node, walkRoot);
  }

  function walkT(tNode: TagLikeNode, insideVariableComponent: boolean): void {
    for (const child of tNode.children ?? []) {
      walkChild(child, insideVariableComponent);
    }
  }

  function walkChild(node: Node, insideVariableComponent: boolean): void {
    const line = node.position?.start.line ?? 0;
    switch (node.type) {
      case 'text':
        break;
      case 'expression': {
        if (insideVariableComponent) break;
        if (isPlainStringLiteral(node)) break;
        errors.push({
          file: filePath,
          line,
          message: `Unwrapped dynamic content inside <T> at line ${line}. Wrap in <Var>, <Num>, <Currency>, <DateTime>, or <Plural>.`,
          severity: 'error',
        });
        break;
      }
      case 'fragment': {
        const frag = node as TagLikeNode;
        if (frag.name === 'Fragment') {
          errors.push({
            file: filePath,
            line,
            message: '<Fragment> is not supported inside <T>',
            severity: 'error',
          });
        } else {
          // shorthand <></>
          for (const c of frag.children ?? []) walkChild(c, insideVariableComponent);
        }
        break;
      }
      case 'element':
      case 'component':
      case 'custom-element': {
        const tag = node as TagLikeNode;
        const name = tag.name;

        if (name === 'slot') {
          errors.push({
            file: filePath,
            line,
            message: '<slot> is not supported inside <T>',
            severity: 'error',
          });
          break;
        }
        if (name === 'style' || name === 'script') {
          errors.push({
            file: filePath,
            line,
            message: `<${name}> is not supported inside <T>`,
            severity: 'error',
          });
          break;
        }

        if (RESERVED_TYNDALE_TAGS.has(name)) {
          if (name === 'Plural') {
            validatePluralAttrs(tag);
          } else if (name !== 'Currency' && name !== 'DateTime' && name !== 'Num') {
            // <Var> must have a literal `name` attribute.
            validateVarAttrs(tag);
          }
          for (const c of tag.children ?? []) walkChild(c, true);
        } else {
          for (const c of tag.children ?? []) walkChild(c, insideVariableComponent);
        }
        break;
      }
      default:
        break;
    }
  }

  function validateVarAttrs(tag: TagLikeNode): void {
    const attr = findAttr(tag, 'name');
    if (!attr || attr.kind !== 'quoted') {
      errors.push({
        file: filePath,
        line: tag.position?.start.line ?? 0,
        message: '<Var> requires a literal string `name` attribute',
        severity: 'error',
      });
    }
  }

  function validatePluralAttrs(tag: TagLikeNode): void {
    const count = findAttr(tag, 'count');
    if (!count) {
      errors.push({
        file: filePath,
        line: tag.position?.start.line ?? 0,
        message: '<Plural> requires a `count` attribute',
        severity: 'error',
      });
    }
    const hasOther = !!findAttr(tag, 'other');
    if (!hasOther) {
      errors.push({
        file: filePath,
        line: tag.position?.start.line ?? 0,
        message: '<Plural> requires an `other` branch',
        severity: 'error',
      });
    }
  }
}

function isTag(node: Node, name: string): boolean {
  return (
    (node.type === 'element' || node.type === 'component' || node.type === 'custom-element') &&
    (node as { name?: string }).name === name
  );
}

function findAttr(tag: TagLikeNode, name: string): AttributeNode | undefined {
  return tag.attributes.find((a) => a.name === name);
}

function forEachChild(node: Node, fn: (child: Node) => void): void {
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) fn(child);
  }
}

function isPlainStringLiteral(node: Node): boolean {
  const children = (node as { children?: Node[] }).children ?? [];
  let raw = '';
  for (const c of children) {
    if (c.type !== 'text') return false;
    raw += (c as { value: string }).value;
  }
  const trimmed = raw.trim();
  if (trimmed.length < 2) return false;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "'" || first === '"' || first === '`') && first === last) {
    return true;
  }
  return false;
}