import type { File } from '@babel/types';
import _traverse from '@babel/traverse';
import { computeHash } from 'tyndale-react'
import type { ExtractedEntry } from './t-extractor';

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

/**
 * Names of tyndale-react hooks/functions whose return value is a `t()` function.
 */
const T_FUNCTION_SOURCES = new Set(['useTranslation', 'getTranslation']);

/**
 * Names of marker functions whose first argument is an extractable string.
 */
const MARKER_FUNCTIONS = new Set(['msg']);

export function extractStrings(ast: File, filePath: string): StringExtractionResult {
  const entries: ExtractedEntry[] = [];
  const errors: ExtractionError[] = [];

  // Step 1: Find tyndale imports to determine which identifiers are extractable.
  const tyndaleImports = new Set<string>();
  const tBindings = new Set<string>();

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

  // If no tyndale imports, nothing to extract
  if (tyndaleImports.size === 0) return { entries, errors };

  // Step 2: Find `const t = useTranslation()` or `const t = await getTranslation()`
  // bindings to track which local variables are `t` functions.
  traverse(ast, {
    VariableDeclarator(path: any) {
      const init = path.node.init;
      if (!init) return;

      // `const t = useTranslation()`
      let calleeName: string | null = null;

      if (init.type === 'CallExpression' && init.callee.type === 'Identifier') {
        calleeName = init.callee.name;
      }
      // `const t = await getTranslation()`
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

  // Step 3: Find all call expressions where the callee is a known t/msg binding.
  traverse(ast, {
    CallExpression(path: any) {
      const callee = path.node.callee;
      if (callee.type !== 'Identifier') return;
      if (!tBindings.has(callee.name)) return;

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
        // Non-literal argument — this is an error
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
