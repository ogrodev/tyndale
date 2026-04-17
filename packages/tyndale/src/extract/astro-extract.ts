/**
 * Orchestrator for `.astro` file extraction. Composes the Astro parser,
 * frontmatter Babel extraction, template `<T>` extraction, and template-side
 * `{t('...')}` extraction into a single entry point.
 *
 * Mirrors the shape of the `.tsx` extraction path in `commands/extract.ts`.
 */
import { parseAstro, parseFrontmatterAsTs } from '../astro/parser.js';
import { extractTemplateExpressions } from '../astro/expression-source.js';
import {
  collectTBindings,
  extractStringCalls,
  extractStringCallsFromExpressions,
  type ExtractionError,
} from './string-extractor.js';
import { extractTFromAstro, type ExtractedEntry } from './t-extractor.js';
import { validateTFromAstro } from './validator.js';

export interface AstroExtractResult {
  entries: ExtractedEntry[];
  errors: ExtractionError[];
}

export async function extractFromAstroFile(
  code: string,
  filePath: string,
): Promise<AstroExtractResult> {
  const entries: ExtractedEntry[] = [];
  const errors: ExtractionError[] = [];

  let file;
  try {
    file = await parseAstro(code, filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push({
      file: filePath,
      line: 0,
      message,
      severity: 'error',
    });
    return { entries, errors };
  }

  // Frontmatter → Babel AST → string calls.
  let frontmatterBindings = { tyndaleImports: new Set<string>(), tBindings: new Set<string>() };
  if (file.frontmatter.trim().length > 0) {
    try {
      const fmAst = parseFrontmatterAsTs(file.frontmatter, filePath, file.frontmatterStartLine);
      frontmatterBindings = collectTBindings(fmAst);
      const fmResult = extractStringCalls(fmAst, filePath, frontmatterBindings);
      entries.push(...fmResult.entries);
      errors.push(...fmResult.errors);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        file: filePath,
        line: file.frontmatterStartLine,
        message: `Failed to parse frontmatter: ${message}`,
        severity: 'error',
      });
    }
  }

  // Template `{t('...')}` expressions (excludes expressions inside <T>).
  const templateExprs = extractTemplateExpressions(file.templateRoot);
  if (templateExprs.length > 0 && frontmatterBindings.tBindings.size > 0) {
    const exprResult = extractStringCallsFromExpressions(
      templateExprs,
      filePath,
      frontmatterBindings,
    );
    entries.push(...exprResult.entries);
    errors.push(...exprResult.errors);
  }

  // `<T>…</T>` in template.
  entries.push(...extractTFromAstro(file.templateRoot, filePath));
  errors.push(...validateTFromAstro(file.templateRoot, filePath));

  return { entries, errors };
}
