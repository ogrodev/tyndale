import type { File } from '@babel/types';
import _traverse from '@babel/traverse';
import { computeHash } from 'tyndale-react'
import type { ExtractedEntry } from './t-extractor.js';

const traverse = (_traverse as any).default ?? _traverse;

export interface ExtractionError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface StringExtractionResult {
  entries: ExtractedEntry[];
  errors: ExtractionError[];
}

/** Names of tyndale-react hooks/functions whose return value is a `t()` function. */
const T_FUNCTION_SOURCES = new Set(['useTranslation', 'getTranslation']);

/** Names of marker functions whose first argument is an extractable string. */
const MARKER_FUNCTIONS = new Set(['msg', 'msgString']);

export interface TBindings {
  /** Local identifiers imported from `tyndale-react`. */
  tyndaleImports: Set<string>;
  /**
   * Local identifiers that refer to an extractable callable — either a marker
   * function (`msg`, `msgString`) imported directly, or a variable bound to
   * the result of `useTranslation()` / `await getTranslation()`.
   */
  tBindings: Set<string>;
}

/**
 * Scan a module AST for tyndale-react imports and `t` bindings. Returns the
 * identifiers that the call-site extractor should treat as extractable.
 *
 * Separated from `extractStringCalls` so alternate front-ends (e.g. Astro,
 * where frontmatter bindings are used by template expressions) can reuse the
 * binding set across multiple parses.
 */
export function collectTBindings(ast: File): TBindings {
  const tyndaleImports = new Set<string>();
  const tBindings = new Set<string>();

  // Pass 1: tyndale-react imports.
  traverse(ast, {
    ImportDeclaration(path: any) {
      const source = path.node.source.value;
      if (source !== 'tyndale-react') return;

      for (const specifier of path.node.specifiers) {
        if (specifier.type === 'ImportSpecifier') {
          const imported =
            specifier.imported.type === 'Identifier'
              ? specifier.imported.name
              : specifier.imported.value;
          const local = specifier.local.name;

          tyndaleImports.add(local);

          if (MARKER_FUNCTIONS.has(imported)) {
            tBindings.add(local);
          }
        }
      }
    },
  });

  // If no tyndale imports, nothing binds t; skip the second pass.
  if (tyndaleImports.size === 0) {
    return { tyndaleImports, tBindings };
  }

  // Pass 2: `const t = useTranslation()` / `const t = await getTranslation()`.
  traverse(ast, {
    VariableDeclarator(path: any) {
      const init = path.node.init;
      if (!init) return;

      let calleeName: string | null = null;

      if (init.type === 'CallExpression' && init.callee.type === 'Identifier') {
        calleeName = init.callee.name;
      }
      if (
        init.type === 'AwaitExpression' &&
        init.argument?.type === 'CallExpression' &&
        init.argument.callee.type === 'Identifier'
      ) {
        calleeName = init.argument.callee.name;
      }

      if (calleeName && T_FUNCTION_SOURCES.has(calleeName) && tyndaleImports.has(calleeName)) {
        const localName = path.node.id.type === 'Identifier' ? path.node.id.name : null;
        if (localName) {
          tBindings.add(localName);
        }
      }
    },
  });

  return { tyndaleImports, tBindings };
}

/**
 * Walk the AST collecting every extractable string-literal call, and report
 * errors for non-literal arguments. Expects bindings from `collectTBindings`.
 */
export function extractStringCalls(
  ast: File,
  filePath: string,
  bindings: TBindings,
): StringExtractionResult {
  const entries: ExtractedEntry[] = [];
  const errors: ExtractionError[] = [];

  if (bindings.tyndaleImports.size === 0 && bindings.tBindings.size === 0) {
    return { entries, errors };
  }

  traverse(ast, {
    CallExpression(path: any) {
      const callee = path.node.callee;
      if (callee.type !== 'Identifier') return;
      if (!bindings.tBindings.has(callee.name)) return;

      const args = path.node.arguments;
      if (args.length === 0) return;

      const firstArg = args[0];
      const line = path.node.loc?.start.line ?? 0;

      if (firstArg.type === 'StringLiteral') {
        const value = firstArg.value;
        const hash = computeHash(value);
        const fnLabel = MARKER_FUNCTIONS.has(callee.name) ? 'msg' : 't';

        entries.push({
          hash,
          wireFormat: value,
          type: 'string',
          context: `${filePath}:${fnLabel}@${line}`,
        });
      } else {
        const fnLabel = callee.name;
        errors.push({
          file: filePath,
          line,
          message: `non-literal argument to ${fnLabel}() at line ${line}. Only string literals are extractable.`,
          severity: 'error',
        });
      }
    },
  });

  return { entries, errors };
}

/** Thin wrapper preserving the original single-pass public API. */
export function extractStrings(ast: File, filePath: string): StringExtractionResult {
  const bindings = collectTBindings(ast);
  return extractStringCalls(ast, filePath, bindings);
}

/**
 * Parse each Astro template expression as a TS expression and extract any
 * string-literal `t(...)` / `msg(...)` call sites using the provided bindings
 * (typically collected from the surrounding `.astro` frontmatter).
 *
 * Line numbers in emitted entries/errors match the original `.astro` source
 * lines (the line-offset padding is applied internally).
 */
import { parseSource } from './ast-parser.js';
import type { TemplateExpression } from '../astro/expression-source.js';

export function extractStringCallsFromExpressions(
  expressions: TemplateExpression[],
  filePath: string,
  bindings: TBindings,
): StringExtractionResult {
  const entries: ExtractedEntry[] = [];
  const errors: ExtractionError[] = [];

  for (const expr of expressions) {
    // Wrap the expression as a parenthesized statement so any expression shape
    // parses cleanly as a module.
    const padding = '\n'.repeat(Math.max(0, expr.startLine - 1));
    const wrapped = `${padding};(${expr.source});`;
    let ast: File;
    try {
      ast = parseSource(wrapped, filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        file: filePath,
        line: expr.startLine,
        message: `Failed to parse template expression at line ${expr.startLine}: ${message}`,
        severity: 'error',
      });
      continue;
    }
    const result = extractStringCalls(ast, filePath, bindings);
    entries.push(...result.entries);
    errors.push(...result.errors);
  }

  return { entries, errors };
}