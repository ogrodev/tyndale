// packages/tyndale/src/commands/validate.ts
import type { CommandResult } from '../cli.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../config.js';
import { walkSourceFiles } from '../extract/file-walker.js';
import { parseSource } from '../extract/ast-parser.js';
import { extractTComponents, type ExtractedEntry } from '../extract/t-extractor.js';
import { extractStrings } from '../extract/string-extractor.js';
import { validateTComponent } from '../extract/validator.js';
import { createProgress, createTerminalUi } from '../terminal/ui.js';
import type { JSXElement } from '@babel/types';
import _traverse from '@babel/traverse';

const traverse = (_traverse as any).default ?? _traverse;

interface Logger {
  log(msg: string): void;
  error(msg: string): void;
}

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
  logger: Logger = console,
): Promise<ValidateResult & CommandResult> {
  const isCliInvocation = typeof flagsOrProjectRoot !== 'string';
  const projectRoot = typeof flagsOrProjectRoot === 'string'
    ? flagsOrProjectRoot
    : process.cwd();
  const isConsoleLogger = logger === console;
  const interactiveTerminal = isConsoleLogger && process.stdout.isTTY === true;
  const ui = isCliInvocation
    ? createTerminalUi({
        write: logger.log.bind(logger),
        error: logger.error.bind(logger),
        decorated: interactiveTerminal,
      })
    : null;

  if (ui) {
    ui.header('Validate source strings', 'Dry-run extraction with diagnostics, stale-hash checks, and timing');
  }

  let config;
  try {
    config = loadConfig(projectRoot);
  } catch (err) {
    const result = {
      exitCode: 1,
      errors: [{ file: 'tyndale.config.json', message: (err as Error).message }],
      warnings: [],
      entryCount: 0,
    };
    if (ui) {
      ui.fail(`tyndale.config.json: ${(err as Error).message}`);
    }
    return result;
  }

  const rawConfig = JSON.parse(readFileSync(join(projectRoot, 'tyndale.config.json'), 'utf-8'));
  const source: string[] = rawConfig.source ?? config.include ?? ['src'];
  const extensions: string[] = config.extensions ?? ['.ts', '.tsx', '.js', '.jsx'];
  const output: string = rawConfig.output ?? 'public/_tyndale';

  if (ui) {
    ui.section('Preflight');
    ui.rows([
      { label: 'project root', value: projectRoot },
      { label: 'source dirs', value: source.join(', ') },
      { label: 'extensions', value: extensions.join(', ') },
      { label: 'output dir', value: output },
    ]);
  }

  const allEntries: ExtractedEntry[] = [];
  const allErrors: Diagnostic[] = [];

  const files = await walkSourceFiles({
    source,
    extensions,
    rootDir: projectRoot,
  });

  if (ui) {
    ui.section('Scan source');
    ui.rows([{ label: 'source files', value: files.length }]);
  }

  const progress = ui
    ? createProgress({
        total: files.length,
        noun: 'files',
        interactive: interactiveTerminal,
        decorated: interactiveTerminal,
        writeLine: interactiveTerminal ? undefined : logger.log.bind(logger),
      })
    : null;

  for (const filePath of files) {
    const relativePath = filePath.replace(projectRoot + '/', '');
    const errorCountBefore = allErrors.length;
    let code: string;

    try {
      code = readFileSync(filePath, 'utf-8');
    } catch {
      allErrors.push({ file: relativePath, message: 'Failed to read source file' });
      progress?.tick(relativePath, false);
      continue;
    }

    let ast;
    try {
      ast = parseSource(code, relativePath);
    } catch (err) {
      allErrors.push({
        file: relativePath,
        message: `Parse error: ${(err as Error).message}`,
      });
      progress?.tick(relativePath, false);
      continue;
    }

    const tEntries = extractTComponents(ast, relativePath);
    allEntries.push(...tEntries);

    traverse(ast, {
      JSXElement(path: any) {
        const opening = path.node.openingElement;
        if (
          opening.name.type === 'JSXIdentifier' &&
          opening.name.name === 'T'
        ) {
          const validationErrors = validateTComponent(path.node as JSXElement, relativePath);
          for (const error of validationErrors) {
            allErrors.push({
              file: error.file,
              line: error.line,
              message: error.message.includes('dynamic content')
                ? error.message
                : 'Unwrapped dynamic content inside <T>',
            });
          }
          path.skip();
        }
      },
    });

    const stringResult = extractStrings(ast, relativePath);
    allEntries.push(...stringResult.entries);

    for (const error of stringResult.errors) {
      allErrors.push({
        file: error.file,
        line: error.line,
        message: error.message.includes('literal')
          ? error.message
          : 'Non-literal argument to t() or msg()',
      });
    }

    progress?.tick(relativePath, allErrors.length === errorCountBefore);
  }

  progress?.done();

  const warnings: Diagnostic[] = [];
  const currentHashes = new Set(allEntries.map((entry) => entry.hash));

  for (const locale of config.locales) {
    const localePath = join(projectRoot, output, `${locale}.json`);
    try {
      const raw = readFileSync(localePath, 'utf-8');
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
      // Locale file doesn't exist yet — not an error for validate.
    }
  }

  const exitCode = allErrors.length > 0 ? 1 : 0;

  if (ui) {
    if (allErrors.length > 0) {
      ui.section(`Errors (${allErrors.length})`);
      for (const error of allErrors) {
        const location = error.line ? `${error.file}:${error.line}` : error.file;
        ui.issue('failure', location, error.message);
      }
    }

    if (warnings.length > 0) {
      ui.section(`Warnings (${warnings.length})`);
      for (const warning of warnings) {
        const location = warning.line ? `${warning.file}:${warning.line}` : warning.file;
        ui.issue('warning', location, warning.message);
      }
    }

    ui.summary('Validation summary', [
      {
        label: 'status',
        value: exitCode === 0 ? 'validated' : 'validation failed',
        tone: exitCode === 0 ? 'success' : 'failure',
      },
      { label: 'entries', value: allEntries.length },
      { label: 'errors', value: allErrors.length, tone: allErrors.length > 0 ? 'failure' : 'muted' },
      { label: 'warnings', value: warnings.length, tone: warnings.length > 0 ? 'warning' : 'muted' },
    ], `${allEntries.length} entries validated, ${allErrors.length} errors, ${warnings.length} warnings`);
  }

  return {
    exitCode,
    errors: allErrors,
    warnings,
    entryCount: allEntries.length,
  };
}
