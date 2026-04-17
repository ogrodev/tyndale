import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import type { CommandResult } from '../cli';
import { loadConfig } from '../config';
import { walkSourceFiles } from '../extract/file-walker';
import { parseSource } from '../extract/ast-parser';
import { extractTComponents, type ExtractedEntry } from '../extract/t-extractor';
import { extractStrings, type ExtractionError } from '../extract/string-extractor';
import { extractFromAstroFile } from '../extract/astro-extract';
import { extractDictionaries } from '../extract/dict-extractor';
import { validateTComponent, detectStaleHashes } from '../extract/validator';
import { writeExtractionOutput } from '../extract/output-writer';
import { formatExtractionReport, type ExtractionReport } from '../utils/reporter';
import { createProgress, createTerminalUi } from '../terminal/ui';
import type { JSXElement } from '@babel/types';
import _traverse from '@babel/traverse';

const traverse = (_traverse as any).default ?? _traverse;

/** Defaults for optional config fields not in TyndaleConfig type. */
const DEFAULT_SOURCE = ['src'];
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.astro'];
const DEFAULT_OUTPUT = 'public/_tyndale';

interface Logger {
  log(msg: string): void;
  error(msg: string): void;
}

/**
 * Runs the `tyndale extract` command.
 *
 * 1. Loads config
 * 2. Walks source files
 * 3. Parses and extracts <T>, t(), msg() entries
 * 4. Extracts dictionary entries
 * 5. Validates
 * 6. Writes output
 * 7. Reports
 */
export async function runExtract(
  _flags: Record<string, string | boolean>,
  cwd?: string,
  logger: Logger = console,
): Promise<CommandResult> {
  const rootDir = cwd ?? process.cwd();
  const isConsoleLogger = logger === console;
  const interactiveTerminal = isConsoleLogger && process.stdout.isTTY === true;
  const ui = createTerminalUi({
    write: logger.log.bind(logger),
    error: logger.error.bind(logger),
    decorated: interactiveTerminal,
  });

  ui.header('Extract source strings', 'Scan source files, validate messages, and refresh manifest output');

  let config;
  try {
    config = loadConfig(rootDir);
  } catch (err: any) {
    ui.fail(`Failed to load config: ${err.message}`);
    return { exitCode: 1 };
  }

  const source: string[] = config.source ?? config.include ?? DEFAULT_SOURCE;
  const extensions: string[] = config.extensions ?? DEFAULT_EXTENSIONS;
  const output: string = config.output ?? DEFAULT_OUTPUT;
  const dictionaryIncludes = config.dictionaries?.include ?? [];

  ui.section('Preflight');
  ui.rows([
    { label: 'root', value: rootDir },
    { label: 'source dirs', value: source.join(', ') },
    { label: 'extensions', value: extensions.join(', ') },
    { label: 'output dir', value: output },
    { label: 'dictionaries', value: dictionaryIncludes.length > 0 ? dictionaryIncludes.length : 'none' },
  ]);

  const allEntries: ExtractedEntry[] = [];
  const allErrors: ExtractionError[] = [];

  const files = await walkSourceFiles({
    source,
    extensions,
    rootDir,
  });

  ui.section('Scan source');
  ui.rows([{ label: 'source files', value: files.length }]);

  const progress = createProgress({
    total: files.length,
    noun: 'files',
    interactive: interactiveTerminal,
    decorated: interactiveTerminal,
    writeLine: interactiveTerminal ? undefined : logger.log.bind(logger),
  });

  for (const filePath of files) {
    const relativePath = filePath.replace(rootDir + '/', '');
    const errorCountBefore = allErrors.length;
    let code: string;

    try {
      code = readFileSync(filePath, 'utf-8');
    } catch {
      allErrors.push({
        file: relativePath,
        line: 0,
        message: 'Failed to read source file',
        severity: 'error',
      });
      progress.tick(relativePath, false);
      continue;
    }

    if (filePath.endsWith('.astro')) {
      const astroResult = await extractFromAstroFile(code, relativePath);
      allEntries.push(...astroResult.entries);
      allErrors.push(...astroResult.errors);
      progress.tick(relativePath, allErrors.length === errorCountBefore);
      continue;
    }

    let ast;
    try {
      ast = parseSource(code, relativePath);
    } catch (err: any) {
      allErrors.push({
        file: relativePath,
        line: 0,
        message: `Parse error: ${err.message}`,
        severity: 'error',
      });
      progress.tick(relativePath, false);
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
          const errors = validateTComponent(path.node as JSXElement, relativePath);
          allErrors.push(...errors);
          path.skip();
        }
      },
    });

    const stringResult = extractStrings(ast, relativePath);
    allEntries.push(...stringResult.entries);
    allErrors.push(...stringResult.errors);

    progress.tick(relativePath, allErrors.length === errorCountBefore);
  }

  progress.done();

  let dictionaryEntryCount = 0;
  if (dictionaryIncludes.length > 0) {
    ui.section('Dictionary pass');
    const dictEntries = await extractDictionaries({
      include: dictionaryIncludes,
      rootDir,
    });
    dictionaryEntryCount = dictEntries.length;
    allEntries.push(...dictEntries);
    ui.rows([{ label: 'dictionary entries', value: dictionaryEntryCount }]);
  }

  const currentHashes = new Set(allEntries.map((entry) => entry.hash));
  const allWarnings: ExtractionError[] = [];
  const outputDir = join(rootDir, output);
  const defaultLocaleFile = join(outputDir, `${config.defaultLocale}.json`);

  let previousLocaleData: Record<string, string> = {};
  if (existsSync(defaultLocaleFile)) {
    try {
      previousLocaleData = JSON.parse(readFileSync(defaultLocaleFile, 'utf-8'));
    } catch {
      allWarnings.push({
        file: `${config.defaultLocale}.json`,
        line: 0,
        message: 'Existing locale file is unreadable; stale hash detection skipped for previous data.',
        severity: 'warning',
      });
    }
  }

  const staleWarnings = detectStaleHashes(
    currentHashes,
    previousLocaleData,
    `${config.defaultLocale}.json`,
  );
  allWarnings.push(...staleWarnings);

  const previousHashes = new Set(Object.keys(previousLocaleData));
  const uniqueEntries = new Map<string, ExtractedEntry>();
  for (const entry of allEntries) {
    if (!uniqueEntries.has(entry.hash)) {
      uniqueEntries.set(entry.hash, entry);
    }
  }

  const totalUnique = uniqueEntries.size;
  const newCount = [...uniqueEntries.keys()].filter((hash) => !previousHashes.has(hash)).length;
  const removedCount = [...previousHashes].filter((hash) => !currentHashes.has(hash)).length;
  const unchangedCount = totalUnique - newCount;

  ui.section('Write output');
  ui.rows([
    { label: 'manifest dir', value: outputDir },
    { label: 'entries', value: totalUnique },
    { label: 'dictionary entries', value: dictionaryEntryCount },
  ]);

  await writeExtractionOutput({
    entries: allEntries,
    outputDir,
    defaultLocale: config.defaultLocale,
    locales: config.locales,
  });

  const report: ExtractionReport = {
    total: totalUnique,
    newEntries: newCount,
    removed: removedCount,
    unchanged: unchangedCount,
    errors: allErrors,
    warnings: allWarnings,
  };

  const outputText = formatExtractionReport(report, { decorated: isConsoleLogger });
  if (allErrors.length > 0) {
    logger.error(outputText);
    return { exitCode: 1 };
  }

  logger.log(outputText);
  return { exitCode: 0 };
}
