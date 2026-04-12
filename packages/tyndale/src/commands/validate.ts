// packages/tyndale/src/commands/validate.ts
import type { CommandResult } from '../cli';
import { join } from 'node:path';
import { readFile, readFileSync, existsSync } from 'node:fs';
import { readFile as fsReadFile } from 'node:fs/promises';
import { loadConfig } from '../config';
import { walkSourceFiles } from '../extract/file-walker';
import { parseSource } from '../extract/ast-parser';
import { extractTComponents, type ExtractedEntry } from '../extract/t-extractor';
import { extractStrings, type ExtractionError } from '../extract/string-extractor';
import { validateTComponent } from '../extract/validator';
import type { JSXElement } from '@babel/types';
import _traverse from '@babel/traverse';

const traverse = (_traverse as any).default ?? _traverse;

export interface Diagnostic {
  file: string;
  line?: number;
  message: string;
}

export interface ValidateResult {
  exitCode: number;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  entryCount: number;
}

export async function runValidate(
  flagsOrProjectRoot: Record<string, string | boolean> | string,
): Promise<ValidateResult & CommandResult> {
  // Support both CLI flags mode and direct projectRoot mode
  const projectRoot = typeof flagsOrProjectRoot === 'string'
    ? flagsOrProjectRoot
    : process.cwd();

  let config;
  try {
    config = loadConfig(projectRoot);
  } catch (err) {
    return {
      exitCode: 1,
      errors: [{ file: 'tyndale.config.json', message: (err as Error).message }],
      warnings: [],
      entryCount: 0,
    };
  }

  // Read raw config for fields not in TyndaleConfig type
  const rawConfig = JSON.parse(
    require('fs').readFileSync(join(projectRoot, 'tyndale.config.json'), 'utf-8'),
  );
  const source: string[] = rawConfig.source ?? config.include ?? ['src'];
  const extensions: string[] = config.extensions ?? ['.ts', '.tsx', '.js', '.jsx'];
  const output: string = rawConfig.output ?? 'public/_tyndale';

  // Walk and extract entries (dry-run — no file writes)
  const allEntries: ExtractedEntry[] = [];
  const allErrors: Diagnostic[] = [];

  const files = await walkSourceFiles({
    source,
    extensions,
    rootDir: projectRoot,
  });

  for (const filePath of files) {
    const relativePath = filePath.replace(projectRoot + '/', '');
    let code: string;

    try {
      code = require('fs').readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    let ast;
    try {
      ast = parseSource(code, relativePath);
    } catch {
      continue;
    }

    // Extract <T> components
    const tEntries = extractTComponents(ast, relativePath);
    allEntries.push(...tEntries);

    // Validate <T> components
    traverse(ast, {
      JSXElement(path: any) {
        const opening = path.node.openingElement;
        if (
          opening.name.type === 'JSXIdentifier' &&
          opening.name.name === 'T'
        ) {
          const validationErrors = validateTComponent(path.node as JSXElement, relativePath);
          for (const e of validationErrors) {
            allErrors.push({
              file: e.file,
              line: e.line,
              message: e.message.includes('dynamic content')
                ? e.message
                : `Unwrapped dynamic content inside <T>`,
            });
          }
          path.skip();
        }
      },
    });

    // Extract t()/msg() strings
    const stringResult = extractStrings(ast, relativePath);
    allEntries.push(...stringResult.entries);

    // String extraction errors — check for non-literal t() arguments
    for (const e of stringResult.errors) {
      allErrors.push({
        file: e.file,
        line: e.line,
        message: e.message.includes('literal')
          ? e.message
          : `Non-literal argument to t() or msg()`,
      });
    }
  }

  // Check for stale translations in existing locale files
  const warnings: Diagnostic[] = [];
  const currentHashes = new Set(allEntries.map((e) => e.hash));

  for (const locale of config.locales) {
    const localePath = join(projectRoot, output, `${locale}.json`);
    try {
      const raw = require('fs').readFileSync(localePath, 'utf-8');
      const localeData = JSON.parse(raw) as Record<string, string>;
      for (const hash of Object.keys(localeData)) {
        if (!currentHashes.has(hash)) {
          warnings.push({
            file: `${locale}.json`,
            message: `stale translation hash "${hash}" no longer referenced in source`,
          });
        }
      }
    } catch {
      // Locale file doesn't exist yet — not an error for validate
    }
  }

  const exitCode = allErrors.length > 0 ? 1 : 0;

  // CLI output when called from CLI
  if (typeof flagsOrProjectRoot !== 'string') {
    if (allErrors.length > 0) {
      for (const err of allErrors) {
        console.error(`ERROR ${err.file}${err.line ? `:${err.line}` : ''}: ${err.message}`);
      }
    }
    if (warnings.length > 0) {
      for (const warn of warnings) {
        console.warn(`WARN ${warn.file}${warn.line ? `:${warn.line}` : ''}: ${warn.message}`);
      }
    }

    console.log(
      `✓ ${allEntries.length} entries validated\n${allErrors.length} errors, ${warnings.length} warnings`,
    );
    process.exit(exitCode);
  }

  return {
    exitCode,
    errors: allErrors,
    warnings,
    entryCount: allEntries.length,
  };
}
