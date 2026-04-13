// packages/tyndale/src/commands/translate-docs.ts
import type { CommandResult } from '../cli';
import { join, relative, dirname } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'fs';
import type { TranslationSession } from '../translate/batch-translator';
import { resolveConcurrency } from '../translate/concurrency';
import { runPool } from '../translate/pool';
import { createProgress, createTerminalUi, type TerminalRow } from '../terminal/ui';

/** Locale code → full language name. */
const LOCALE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  ar: 'Arabic', ru: 'Russian', nl: 'Dutch', sv: 'Swedish', pl: 'Polish',
  tr: 'Turkish', th: 'Thai', vi: 'Vietnamese', hi: 'Hindi', he: 'Hebrew',
  uk: 'Ukrainian', cs: 'Czech', da: 'Danish', fi: 'Finnish', el: 'Greek',
  hu: 'Hungarian', id: 'Indonesian', ms: 'Malay', no: 'Norwegian',
  ro: 'Romanian', sk: 'Slovak', bg: 'Bulgarian', hr: 'Croatian',
  lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', sl: 'Slovenian',
  ca: 'Catalan', eu: 'Basque', gl: 'Galician',
};

function getLanguageName(locale: string): string {
  return LOCALE_NAMES[locale] ?? locale;
}

interface Logger {
  log(msg: string): void;
  error(msg: string): void;
}

export interface TranslateDocsOptions {
  contentDir: string;
  locales: string[];
  defaultLocale: string;
  extensions: string[];
  concurrency?: number;
  force?: boolean;
}

export interface TranslateDocsDeps {
  createSession: () => Promise<TranslationSession>;
}

interface WorkUnit {
  locale: string;
  languageName: string;
  sourcePath: string;
  targetPath: string;
  content: string;
}

interface ValidationError {
  file: string;
  locale: string;
  error: string;
  translated: string;
  sourceContent: string;
  languageName: string;
}

// ── Validation ──────────────────────────────────────────────

/** Extract frontmatter string from MDX content. Returns null if no frontmatter found. */
function extractFrontmatter(content: string): { raw: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return { raw: match[1], body: content.slice(match[0].length) };
}

/** Parse YAML frontmatter manually — checks for common AI translation mistakes. */
function parseFrontmatter(raw: string): { valid: boolean; error?: string; data?: Record<string, unknown> } {
  const lines = raw.split('\n');
  const data: Record<string, unknown> = {};

  for (const line of lines) {
    // Skip empty lines and nested YAML (indented lines)
    if (line.trim() === '' || line.startsWith('  ') || line.startsWith('\t')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    // Check for unquoted values starting with reserved YAML chars
    if (value && /^[`@%]/.test(value)) {
      return {
        valid: false,
        error: `Frontmatter value for "${key}" starts with reserved character "${value[0]}" — must be quoted. Value: ${value}`,
      };
    }

    // Check for unbalanced quotes
    if ((value.startsWith('"') && !value.endsWith('"')) ||
        (value.startsWith("'") && !value.endsWith("'"))) {
      return {
        valid: false,
        error: `Frontmatter value for "${key}" has unbalanced quotes. Value: ${value}`,
      };
    }

    data[key] = value;
  }

  return { valid: true, data };
}

/** Validate a translated MDX doc. Returns null if valid, error string if not. */
function validateTranslatedDoc(
  translated: string,
  sourceContent: string,
): string | null {
  // Must have frontmatter
  const fm = extractFrontmatter(translated);
  if (!fm) return 'Missing frontmatter (no --- delimiters found)';

  // Frontmatter must be valid YAML
  const parsed = parseFrontmatter(fm.raw);
  if (!parsed.valid) return parsed.error!;

  // Must have a title
  if (!parsed.data?.title) return 'Missing "title" in frontmatter';

  // Source imports must be preserved
  const sourceImports = sourceContent.match(/^import .+$/gm) ?? [];
  for (const imp of sourceImports) {
    if (!translated.includes(imp)) {
      return `Missing import statement: ${imp}`;
    }
  }

  // Must not be wrapped in code fences (common AI mistake)
  if (translated.trimStart().startsWith('```')) {
    return 'Response wrapped in code fences — must be raw MDX content';
  }

  return null;
}

// ── Prompts ─────────────────────────────────────────────────

function buildDocTranslationPrompt(
  content: string,
  languageName: string,
  localeCode: string,
  filePath: string,
): string {
  return `You are a professional technical documentation translator. Translate the following MDX documentation file from English to ${languageName} (${localeCode}).

FILE: ${filePath}

RULES:
1. Translate all prose text, headings, list items, and table description cells.
2. Translate frontmatter "title" and "description" values. If the value contains special characters like backticks, wrap it in quotes.
3. Translate hero "tagline" and action "text" values in frontmatter.
4. Do NOT translate code blocks (content between \`\`\` markers) — preserve them exactly.
5. Do NOT translate inline code (\`backtick content\`) — preserve exactly.
6. Do NOT translate import statements.
7. Do NOT translate URLs, file paths, or link targets.
8. Do NOT translate component names (<T>, <Steps>, <Card>, <CardGrid>, <Tabs>, etc.).
9. Do NOT translate API names, CLI commands, config field names, or brand names.
10. Preserve all MDX/Astro component syntax, markdown formatting, and whitespace structure.
11. Preserve frontmatter YAML structure (keys, indentation, dashes).
12. Translate naturally and fluently — not word-for-word.
13. CRITICAL: Frontmatter values containing backticks (\`) or colons (:) MUST be wrapped in double quotes.

CONTENT:
${content}

Respond with ONLY the translated MDX file content. No preamble, no explanation, no wrapping code fences.`;
}

function buildDocCorrectionPrompt(
  sourceContent: string,
  brokenTranslation: string,
  error: string,
  languageName: string,
  localeCode: string,
  filePath: string,
): string {
  return `Your previous translation of ${filePath} to ${languageName} (${localeCode}) has a validation error. Fix it.

ERROR: ${error}

YOUR BROKEN OUTPUT:
${brokenTranslation}

ORIGINAL ENGLISH SOURCE:
${sourceContent}

Fix the error and return the corrected translated MDX file. Common fixes:
- Wrap frontmatter values containing backticks or special chars in double quotes: description: "Reference for \`config.json\`"
- Ensure --- delimiters are present at the start
- Preserve all import statements exactly as in the source
- Do not wrap the response in code fences

Respond with ONLY the corrected MDX file content. No preamble, no explanation.`;
}

// ── File discovery ──────────────────────────────────────────

function findFiles(dir: string, extensions: string[], locales: string[]): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const relDir = relative(dir, fullPath);
        if (!relDir.includes('/') && locales.includes(entry)) continue;
        walk(fullPath);
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

// ── Extract text from session result ────────────────────────

function extractText(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (typeof obj.translation === 'string') return obj.translation;
    if (typeof obj.content === 'string') return obj.content;
  }
  return null;
}

// ── Main handler ────────────────────────────────────────────

export async function handleTranslateDocs(
  deps: TranslateDocsDeps,
  options: TranslateDocsOptions,
  logger: Logger,
): Promise<number> {
  const isConsoleLogger = logger === console;
  const interactiveTerminal = isConsoleLogger && process.stdout.isTTY === true;
  const ui = createTerminalUi({
    write: logger.log.bind(logger),
    error: logger.error.bind(logger),
    decorated: interactiveTerminal,
  });
  const { contentDir, locales, defaultLocale, extensions, force } = options;
  const modeLabel = force ? 'force retranslate' : 'missing docs only';

  ui.header('Translate documentation', 'Live document progress with validation retries and correction timing');

  if (!existsSync(contentDir)) {
    ui.fail(`Content directory not found: ${contentDir}`);
    return 1;
  }

  const sourceFiles = findFiles(contentDir, extensions, locales);
  if (sourceFiles.length === 0) {
    ui.summary('Docs summary', [
      { label: 'status', value: 'no source docs found', tone: 'warning' },
      { label: 'content dir', value: contentDir },
      { label: 'target locales', value: locales.length },
    ]);
    return 0;
  }

  const { value: concurrency, source: concurrencySource } = resolveConcurrency(options.concurrency);
  ui.section('Preflight');
  ui.rows([
    { label: 'default locale', value: defaultLocale },
    { label: 'target locales', value: locales.join(', ') || 'none' },
    { label: 'source docs', value: sourceFiles.length },
    { label: 'content dir', value: contentDir },
    { label: 'mode', value: modeLabel },
    { label: 'concurrency', value: `${concurrency} (${concurrencySource === 'auto' ? 'auto-detected' : 'configured'})` },
  ]);

  const workUnits: WorkUnit[] = [];
  for (const locale of locales) {
    const languageName = getLanguageName(locale);
    for (const sourcePath of sourceFiles) {
      const relPath = relative(contentDir, sourcePath);
      const targetPath = join(contentDir, locale, relPath);
      if (!force && existsSync(targetPath)) continue;
      const content = readFileSync(sourcePath, 'utf-8');
      workUnits.push({ locale, languageName, sourcePath, targetPath, content });
    }
  }

  if (workUnits.length === 0) {
    ui.summary('Docs summary', [
      { label: 'status', value: 'all docs already translated', tone: 'success' },
      { label: 'source docs', value: sourceFiles.length },
      { label: 'target locales', value: locales.length },
    ], 'Use --force to retranslate existing docs.');
    return 0;
  }

  const byLocale = new Map<string, number>();
  for (const unit of workUnits) {
    byLocale.set(unit.locale, (byLocale.get(unit.locale) ?? 0) + 1);
  }

  const localeRows: TerminalRow[] = [];
  for (const [locale, count] of byLocale) {
    localeRows.push({ label: locale, value: `${count} docs queued` });
  }

  ui.section('Translation plan');
  ui.rows([
    { label: 'docs queued', value: workUnits.length },
    { label: 'locales active', value: byLocale.size },
  ]);
  ui.rows(localeRows);

  const workUnitByLabel = new Map<string, WorkUnit>();
  for (const unit of workUnits) {
    const label = `${unit.locale}/${relative(contentDir, unit.sourcePath)}`;
    workUnitByLabel.set(label, unit);
  }

  const validationErrors: ValidationError[] = [];
  let translatedDocs = 0;

  ui.section('Translate');
  const progress = createProgress({
    total: workUnits.length,
    noun: 'docs',
    interactive: interactiveTerminal,
    decorated: interactiveTerminal,
    writeLine: interactiveTerminal ? undefined : logger.log.bind(logger),
  });

  await runPool(workUnits, concurrency, async (unit) => {
    const relPath = relative(contentDir, unit.sourcePath);
    const label = `${unit.locale}/${relPath}`;
    try {
      const session = await deps.createSession();
      const prompt = buildDocTranslationPrompt(unit.content, unit.languageName, unit.locale, relPath);
      const result = await session.sendPrompt(prompt);
      const translated = extractText(result);

      if (!translated) {
        validationErrors.push({
          file: label,
          locale: unit.locale,
          error: 'No translation returned',
          translated: '',
          sourceContent: unit.content,
          languageName: unit.languageName,
        });
        progress.tick(label, false);
        return;
      }

      const error = validateTranslatedDoc(translated, unit.content);
      if (error) {
        validationErrors.push({
          file: label,
          locale: unit.locale,
          error,
          translated,
          sourceContent: unit.content,
          languageName: unit.languageName,
        });
        progress.tick(label, false);
        return;
      }

      mkdirSync(dirname(unit.targetPath), { recursive: true });
      writeFileSync(unit.targetPath, translated);
      progress.tick(label, true);
      translatedDocs++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      validationErrors.push({
        file: label,
        locale: unit.locale,
        error: message,
        translated: '',
        sourceContent: unit.content,
        languageName: unit.languageName,
      });
      progress.tick(label, false);
    }
  });
  progress.done();

  let correctedDocs = 0;
  let unresolvedAfterRetry: string[] = [];

  if (validationErrors.length > 0) {
    ui.section('Validation retry');
    ui.rows([
      { label: 'needs correction', value: validationErrors.length, tone: 'warning' },
    ]);
    for (const issue of validationErrors) {
      ui.issue('failure', issue.file, issue.error);
    }

    const retryProgress = createProgress({
      total: validationErrors.length,
      noun: 'corrections',
      interactive: interactiveTerminal,
      decorated: interactiveTerminal,
      writeLine: interactiveTerminal ? undefined : logger.log.bind(logger),
    });

    const retryResults = await runPool(validationErrors, concurrency, async (issue) => {
      try {
        const session = await deps.createSession();
        const [locale, ...relParts] = issue.file.split('/');
        const relPath = relParts.join('/');

        const prompt = buildDocCorrectionPrompt(
          issue.sourceContent,
          issue.translated,
          issue.error,
          issue.languageName,
          locale,
          relPath,
        );
        const result = await session.sendPrompt(prompt);
        const corrected = extractText(result);

        if (!corrected) {
          retryProgress.tick(issue.file, false);
          return { file: issue.file, success: false, error: 'No correction returned' };
        }

        const error = validateTranslatedDoc(corrected, issue.sourceContent);
        if (error) {
          retryProgress.tick(issue.file, false);
          return { file: issue.file, success: false, error };
        }

        const unit = workUnitByLabel.get(issue.file);
        if (unit) {
          mkdirSync(dirname(unit.targetPath), { recursive: true });
          writeFileSync(unit.targetPath, corrected);
        }
        retryProgress.tick(issue.file, true);
        return { file: issue.file, success: true, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        retryProgress.tick(issue.file, false);
        return { file: issue.file, success: false, error: message };
      }
    });
    retryProgress.done();

    for (const result of retryResults) {
      if (result.success) {
        correctedDocs++;
        ui.item(`${result.file} corrected`);
      } else {
        ui.fail(`${result.file}: ${result.error ?? 'unknown error'}`);
      }
    }

    unresolvedAfterRetry = validationErrors
      .filter((issue) => {
        const unit = workUnitByLabel.get(issue.file);
        return unit ? !existsSync(unit.targetPath) : true;
      })
      .map((issue) => issue.file);

    if (unresolvedAfterRetry.length > 0) {
      ui.warn(`${unresolvedAfterRetry.length} docs remain unresolved after retry.`);
    }
  }

  ui.summary('Docs summary', [
    {
      label: 'status',
      value: unresolvedAfterRetry.length > 0 ? 'completed with failures' : 'completed',
      tone: unresolvedAfterRetry.length > 0 ? 'failure' : 'success',
    },
    { label: 'translated', value: translatedDocs },
    { label: 'corrected', value: correctedDocs, tone: correctedDocs > 0 ? 'success' : 'muted' },
    {
      label: 'unresolved',
      value: unresolvedAfterRetry.length,
      tone: unresolvedAfterRetry.length > 0 ? 'failure' : 'muted',
    },
    { label: 'locales active', value: byLocale.size },
  ]);

  return unresolvedAfterRetry.length > 0 ? 1 : 0;
}

/** CLI entry point for `tyndale translate-docs`. */
export async function runTranslateDocs(flags: Record<string, string | boolean>): Promise<CommandResult> {
  const { loadConfig } = await import('../config');
  const config = loadConfig();
  const isMock = process.env.TYNDALE_MOCK_TRANSLATE === '1';

  const contentDir = typeof flags['content-dir'] === 'string'
    ? flags['content-dir']
    : 'src/content/docs';

  const deps: TranslateDocsDeps = {
    createSession: async () => {
      if (isMock) {
        const { createMockDocSession } = await import('../translate/mock-docs');
        return createMockDocSession();
      }
      const { createTextSession } = await import('../translate/pi-session');
      return createTextSession();
    },
  };

  const options: TranslateDocsOptions = {
    contentDir,
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    extensions: ['.mdx', '.md'],
    concurrency: typeof flags.concurrency === 'string'
      ? parseInt(flags.concurrency, 10)
      : config.translate?.concurrency,
    force: flags.force === true,
  };

  const exitCode = await handleTranslateDocs(deps, options, console);
  return { exitCode };
}
