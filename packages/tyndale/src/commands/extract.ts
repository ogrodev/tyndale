import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import type { CommandResult } from '../cli';
import { loadConfig } from '../config'
import { walkSourceFiles } from '../extract/file-walker';
import { parseSource } from '../extract/ast-parser';
import { extractTComponents, type ExtractedEntry } from '../extract/t-extractor';
import { extractStrings, type ExtractionError } from '../extract/string-extractor';
import { extractDictionaries } from '../extract/dict-extractor';
import { validateTComponent, detectStaleHashes } from '../extract/validator';
import { writeExtractionOutput } from '../extract/output-writer';
import { formatExtractionReport, type ExtractionReport } from '../utils/reporter';
import type { JSXElement } from '@babel/types';
import _traverse from '@babel/traverse';

const traverse = (_traverse as any).default ?? _traverse;

/** Defaults for optional config fields not in TyndaleConfig type. */
const DEFAULT_SOURCE = ['src'];
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const DEFAULT_OUTPUT = 'public/_tyndale';

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
  flags: Record<string, string | boolean>,
  cwd?: string,
): Promise<CommandResult> {
  const rootDir = cwd ?? process.cwd();

  // 1. Load config — loadConfig takes a directory, not a file path
  let config;
  try {
    config = loadConfig(rootDir);
  } catch (err: any) {
    console.error(`Failed to load config: ${err.message}`);
    return { exitCode: 1 };
  }

  const source: string[] = config.source ?? config.include ?? DEFAULT_SOURCE;
  const extensions: string[] = config.extensions ?? DEFAULT_EXTENSIONS;
  const output: string = config.output ?? DEFAULT_OUTPUT;

  const allEntries: ExtractedEntry[] = [];
  const allErrors: ExtractionError[] = [];

  // 2. Walk source files
  const files = await walkSourceFiles({
    source,
    extensions,
    rootDir,
  });

  // 3. Parse each file and extract
  for (const filePath of files) {
    const relativePath = filePath.replace(rootDir + '/', '');
    let code: string;

    try {
      code = readFileSync(filePath, 'utf-8');
    } catch {
      console.error(`Failed to read: ${relativePath}`);
      continue;
    }

    let ast;
    try {
      ast = parseSource(code, relativePath);
    } catch (err: any) {
      console.error(`Parse error in ${relativePath}: ${err.message}`);
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
          const errors = validateTComponent(path.node as JSXElement, relativePath);
          allErrors.push(...errors);
          path.skip();
        }
      },
    });

    // Extract t()/msg() strings
    const stringResult = extractStrings(ast, relativePath);
    allEntries.push(...stringResult.entries);
    allErrors.push(...stringResult.errors);
  }

  // 4. Extract dictionary files
  if (config.dictionaries?.include?.length) {
    const dictEntries = await extractDictionaries({
      include: config.dictionaries.include,
      rootDir,
    });
    allEntries.push(...dictEntries);
  }

  // 5. Check for stale hashes
  const currentHashes = new Set(allEntries.map((e) => e.hash));
  const allWarnings: ExtractionError[] = [];
  const outputDir = join(rootDir, output);
  const defaultLocaleFile = join(outputDir, `${config.defaultLocale}.json`);

  let previousLocaleData: Record<string, string> = {};
  if (existsSync(defaultLocaleFile)) {
    try {
      previousLocaleData = JSON.parse(readFileSync(defaultLocaleFile, 'utf-8'));
    } catch {
      // Corrupted file — ignore
    }
  }

  const staleWarnings = detectStaleHashes(
    currentHashes,
    previousLocaleData,
    `${config.defaultLocale}.json`,
  );
  allWarnings.push(...staleWarnings);

  // 6. Compute report stats
  const previousHashes = new Set(Object.keys(previousLocaleData));
  const uniqueEntries = new Map<string, ExtractedEntry>();
  for (const entry of allEntries) {
    if (!uniqueEntries.has(entry.hash)) {
      uniqueEntries.set(entry.hash, entry);
    }
  }
  const totalUnique = uniqueEntries.size;
  const newCount = [...uniqueEntries.keys()].filter((h) => !previousHashes.has(h)).length;
  const removedCount = [...previousHashes].filter((h) => !currentHashes.has(h)).length;
  const unchangedCount = totalUnique - newCount;

  // 7. Write output
  await writeExtractionOutput({
    entries: allEntries,
    outputDir,
    defaultLocale: config.defaultLocale,
    locales: config.locales,
  });

  // 8. Report
  const report: ExtractionReport = {
    total: totalUnique,
    newEntries: newCount,
    removed: removedCount,
    unchanged: unchangedCount,
    errors: allErrors,
    warnings: allWarnings,
  };

  const output_text = formatExtractionReport(report);
  if (allErrors.length > 0) {
    console.error(output_text);
    return { exitCode: 1 };
  }

  console.log(output_text);
  return { exitCode: 0 };
}
