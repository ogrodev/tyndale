// packages/tyndale/src/commands/translate-docs.ts
import { createHash } from 'crypto';
import type { CommandResult } from '../cli.js';
import { join, relative, dirname, extname } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'fs';
import type { TranslationSession } from '../translate/batch-translator.js';
import { resolveConcurrency } from '../translate/concurrency.js';
import type { CreateTranslationSessionOptions } from '../translate/pi-session.js';
import { runPool } from '../translate/pool.js';
import { createProgress, createTerminalUi, type ProgressReporter, type TerminalRow } from '../terminal/ui.js';
import { createTranslateActivityTui, type TranslateActivityController } from '../tui/translate-activity.js';
import { runTui } from '../tui/run-tui.js';
import { splitAstroFast } from '../astro/split-fast.js';

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

const DOCS_STATE_FILENAME = '.tyndale-docs-state.json';

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
  provider?: import('../docs/types.js').DocsProvider;
  cwd?: string;
}

type SessionFactory = (options?: CreateTranslationSessionOptions) => Promise<TranslationSession>;

export interface TranslateDocsDeps {
  createSession: SessionFactory;
}

interface WorkUnit {
  id: string;
  locale: string;
  languageName: string;
  relativePath: string;
  targetPath: string;
  content: string;
  sourceHash: string;
}

interface DocsTranslationState {
  version: 1;
  entries: Record<string, string>;
}

interface ValidationError {
  unitId: string;
  file: string;
  locale: string;
  relativePath: string;
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
  ext: string,
): string | null {
  if (ext === '.astro') {
    return validateTranslatedAstro(translated, sourceContent);
  }

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

/**
 * Validate a translated Astro page. Returns null if valid, error string otherwise.
 *
 * Rules (from Plan B spec §docs-translation validation):
 *   1. splitAstroFast(translated) must return { kind: 'ok' }.
 *   2. Every `import ...;` line in the source frontmatter appears verbatim in the
 *      translated frontmatter.
 *   3. Every Astro directive token (client:*, server:*, set:html, is:raw,
 *      define:vars, class:list) present in the source template is preserved.
 *   4. Translated output must not start with a code fence.
 *   5. Translated template body must contain at least one non-whitespace char.
 */
function validateTranslatedAstro(
  translated: string,
  source: string,
): string | null {
  // Rule 4: code-fence wrapping is a common AI mistake — check before the split so
  // the surrounding fence does not accidentally produce a successful split.
  if (translated.trimStart().startsWith('```')) {
    return 'Response wrapped in code fences — must be raw Astro content (no code fence)';
  }

  // Rule 1: structural split must succeed.
  const tSplit = splitAstroFast(translated);
  switch (tSplit.kind) {
    case 'unclosed-frontmatter':
      return "Translated Astro file has unclosed frontmatter (missing closing '---' fence)";
    case 'invalid-prelude':
      return "Translated Astro file has content before opening '---' fence";
    case 'no-frontmatter':
      return 'Translated Astro file is missing frontmatter (no --- delimiters found)';
    case 'ok':
      break;
  }

  const translatedFrontmatter = tSplit.frontmatter;
  const translatedBody = tSplit.body;

  // Rule 5: template body must be non-empty.
  if (translatedBody.trim().length === 0) {
    return 'Translated Astro file has an empty template body';
  }

  const sSplit = splitAstroFast(source);
  const sourceFrontmatter = sSplit.kind === 'ok' ? sSplit.frontmatter : '';
  const sourceBody = sSplit.kind === 'ok'
    ? sSplit.body
    : sSplit.kind === 'no-frontmatter'
      ? sSplit.body
      : '';

  // Rule 2: source imports preserved verbatim in translated frontmatter.
  const importLines = sourceFrontmatter.match(/^\s*import\b.*;?\s*$/gm) ?? [];
  for (const rawLine of importLines) {
    const imp = rawLine.trim();
    if (imp.length === 0) continue;
    if (!translatedFrontmatter.includes(imp)) {
      return `Missing import statement: ${imp}`;
    }
  }

  // Rule 3: every Astro directive token present in the source template is preserved.
  const directiveRegex = /\b(?:client|server|set|is|define|class):[a-zA-Z]+\b/g;
  const sourceDirectives = new Set(sourceBody.match(directiveRegex) ?? []);
  for (const directive of sourceDirectives) {
    if (!translatedBody.includes(directive)) {
      return `Missing Astro directive: ${directive}`;
    }
  }

  return null;
}

// ── Prompts ─────────────────────────────────────────────────

function buildDocTranslationPrompt(
  content: string,
  languageName: string,
  localeCode: string,
  filePath: string,
  ext: string,
): string {
  if (ext === '.astro') {
    return buildDocTranslationPromptAstro(content, languageName, localeCode, filePath);
  }
  return buildDocTranslationPromptMdx(content, languageName, localeCode, filePath);
}

function buildDocTranslationPromptMdx(
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

function buildDocTranslationPromptAstro(
  content: string,
  languageName: string,
  localeCode: string,
  filePath: string,
): string {
  return `You are a professional technical documentation translator. Translate the following Astro page from English to ${languageName} (${localeCode}).

FILE: ${filePath}

STRUCTURE: An Astro page has two sections separated by \`---\` fences. The top section is the TypeScript/JavaScript frontmatter. The bottom section is the HTML/JSX-like template.

FRONTMATTER RULES:
1. Preserve every \`import\` statement verbatim — do not rename, reorder, or translate module paths.
2. Preserve TypeScript/JavaScript code unchanged. Do NOT translate identifiers, types, property names, or expression syntax.
3. Translate ONLY string literal values that are clearly user-facing (e.g. a \`title\`, \`description\`, or \`heading\` variable assigned a plain string). Leave all surrounding code intact.
4. Preserve the opening and closing \`---\` fences exactly as in the source.

TEMPLATE RULES:
1. Translate visible HTML text content (paragraphs, headings, list items, etc.).
2. Translate these attribute string values when present: \`alt=\`, \`title=\`, \`aria-label=\`, \`aria-description=\`.
3. Do NOT translate component or HTML tag names (<Layout>, <Card>, <T>, <Steps>, etc.).
4. Do NOT translate prop identifiers, CSS class names, non-string attribute values, URLs, file paths, or link targets.
5. Do NOT translate the contents of \`{…}\` expressions — preserve them byte-for-byte.
6. Do NOT translate code blocks (content between \`\`\` markers) or inline code (\`backtick\` spans).
7. CRITICAL: Preserve every Astro directive exactly as written. Directives use a \`namespace:modifier\` syntax and include \`client:*\` (e.g. client:load, client:visible), \`server:*\`, \`set:html\`, \`is:raw\`, \`define:vars\`, and \`class:list\`. Preserve both the directive name and any associated value unchanged.
8. Preserve \`<slot>\` elements and their \`name=\` attributes. Preserve Fragment shorthand (\`<>…</>\`).
9. Preserve whitespace structure (blank lines, indentation of the template).

GENERAL RULES:
- Translate naturally and fluently — not word-for-word.
- Do NOT translate API names, CLI commands, config field names, or brand names.
- Do NOT wrap the response in code fences (no \`\`\`astro fence, no code fence of any kind).

CONTENT:
${content}

Respond with ONLY the translated Astro file content. No preamble, no explanation, no wrapping code fences.`;
}

function buildDocCorrectionPrompt(
  sourceContent: string,
  brokenTranslation: string,
  error: string,
  languageName: string,
  localeCode: string,
  filePath: string,
  ext: string,
): string {
  if (ext === '.astro') {
    return buildDocCorrectionPromptAstro(
      sourceContent,
      brokenTranslation,
      error,
      languageName,
      localeCode,
      filePath,
    );
  }
  return buildDocCorrectionPromptMdx(
    sourceContent,
    brokenTranslation,
    error,
    languageName,
    localeCode,
    filePath,
  );
}

function buildDocCorrectionPromptMdx(
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

function buildDocCorrectionPromptAstro(
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

This is an Astro page with two sections separated by \`---\` fences: a TypeScript frontmatter and an HTML/JSX-like template. Fix the validation error while respecting these rules:

FRONTMATTER:
- Preserve every \`import\` statement verbatim (same module path, same identifier).
- Preserve TypeScript/JavaScript code unchanged. Translate only string literal values that are clearly user-facing.
- Preserve the opening and closing \`---\` fences.

TEMPLATE:
- Translate visible HTML text and these attribute string values when present: \`alt=\`, \`title=\`, \`aria-label=\`, \`aria-description=\`.
- Preserve component and HTML tag names, prop identifiers, CSS class names, URLs, file paths, and \`{…}\` expression contents unchanged.
- CRITICAL: Preserve every Astro directive exactly as written. Directives use a \`namespace:modifier\` syntax and include \`client:*\`, \`server:*\`, \`set:html\`, \`is:raw\`, \`define:vars\`, and \`class:list\`.
- Preserve \`<slot>\` elements and their attributes.

OUTPUT RULES:
- Do NOT wrap the response in code fences (no code fence of any kind).
- Return the complete, corrected Astro file.

Respond with ONLY the corrected Astro file content. No preamble, no explanation.`;
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

function computeSourceHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function normalizeDocsStateSegment(value: string): string {
  return value.replace(/\\/g, '/');
}

function getDocsStatePath(cwd: string): string {
  return join(cwd, DOCS_STATE_FILENAME);
}

function getDocsStateKey(contentDir: string, locale: string, relativePath: string): string {
  return `${normalizeDocsStateSegment(contentDir)}::${locale}::${normalizeDocsStateSegment(relativePath)}`;
}

function loadDocsState(cwd: string): DocsTranslationState {
  const statePath = getDocsStatePath(cwd);
  if (!existsSync(statePath)) return { version: 1, entries: {} };

  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf-8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { version: 1, entries: {} };
    }

    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1 || typeof obj.entries !== 'object' || obj.entries === null || Array.isArray(obj.entries)) {
      return { version: 1, entries: {} };
    }

    const entries = obj.entries as Record<string, unknown>;
    if (!Object.values(entries).every((value) => typeof value === 'string')) {
      return { version: 1, entries: {} };
    }

    return { version: 1, entries: entries as Record<string, string> };
  } catch {
    return { version: 1, entries: {} };
  }
}

function saveDocsState(cwd: string, state: DocsTranslationState): void {
  writeFileSync(getDocsStatePath(cwd), `${JSON.stringify(state, null, 2)}\n`);
}

function isTranslationUpToDate(
  state: DocsTranslationState,
  contentDir: string,
  locale: string,
  relativePath: string,
  sourceHash: string,
  targetPath: string,
): boolean {
  if (!existsSync(targetPath)) return false;
  return state.entries[getDocsStateKey(contentDir, locale, relativePath)] === sourceHash;
}

function markTranslationUpToDate(state: DocsTranslationState, contentDir: string, unit: WorkUnit): void {
  state.entries[getDocsStateKey(contentDir, unit.locale, unit.relativePath)] = unit.sourceHash;
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

interface TranslationPhaseResult {
  translatedDocs: number;
  validationErrors: ValidationError[];
}

interface CorrectionPhaseResult {
  correctedDocs: number;
  unresolvedFiles: string[];
  retryResults: Array<{ file: string; success: boolean; error: string | null }>;
}

function createValidationError(unit: WorkUnit, error: string, translated: string): ValidationError {
  return {
    unitId: unit.id,
    file: unit.id,
    locale: unit.locale,
    relativePath: unit.relativePath,
    error,
    translated,
    sourceContent: unit.content,
    languageName: unit.languageName,
  };
}

async function runDocTranslationWorkUnits(
  workUnits: WorkUnit[],
  concurrency: number,
  createSession: SessionFactory,
  progress: ProgressReporter | null,
  activity?: TranslateActivityController,
  onTranslated?: (unit: WorkUnit) => void,
 ): Promise<TranslationPhaseResult> {
  activity?.registerBatches(
    workUnits.map((unit, index) => ({
      id: unit.id,
      label: unit.id,
      locale: unit.locale,
      batchIndex: index,
    })),
  );

  const results = await runPool<WorkUnit, { translated: boolean; validationError?: ValidationError }>(
    workUnits,
    concurrency,
    async (unit) => {
      activity?.startBatch(unit.id);

      try {
        const session = await createSession(
          activity
            ? {
                onActivity: (event) => activity.recordSessionEvent(unit.id, event),
              }
            : undefined,
        );
        const prompt = buildDocTranslationPrompt(
          unit.content,
          unit.languageName,
          unit.locale,
          unit.relativePath,
          extname(unit.relativePath),
        );
        const result = await session.sendPrompt(prompt);
        const translated = extractText(result);

        if (!translated) {
          const error = 'No translation returned';
          progress?.tick(unit.id, false);
          activity?.finishBatch(unit.id, false, error);
          return { translated: false, validationError: createValidationError(unit, error, '') };
        }

        const error = validateTranslatedDoc(translated, unit.content, extname(unit.relativePath));
        if (error) {
          progress?.tick(unit.id, false);
          activity?.finishBatch(unit.id, false, error);
          return { translated: false, validationError: createValidationError(unit, error, translated) };
        }

        mkdirSync(dirname(unit.targetPath), { recursive: true });
        writeFileSync(unit.targetPath, translated);
        onTranslated?.(unit);
        progress?.tick(unit.id, true);
        activity?.finishBatch(unit.id, true, 'translated');
        return { translated: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        progress?.tick(unit.id, false);
        activity?.finishBatch(unit.id, false, message);
        return { translated: false, validationError: createValidationError(unit, message, '') };
      }
    },
  );

  return {
    translatedDocs: results.filter((result) => result.translated).length,
    validationErrors: results.flatMap((result) => result.validationError ? [result.validationError] : []),
  };
}

async function runDocCorrectionWorkUnits(
  validationErrors: ValidationError[],
  concurrency: number,
  createSession: SessionFactory,
  workUnitById: Map<string, WorkUnit>,
  progress: ProgressReporter | null,
  activity?: TranslateActivityController,
  onCorrected?: (unit: WorkUnit) => void,
 ): Promise<CorrectionPhaseResult> {
  activity?.registerBatches(
    validationErrors.map((issue, index) => ({
      id: issue.unitId,
      label: issue.file,
      locale: issue.locale,
      batchIndex: index,
    })),
  );

  const retryResults = await runPool<ValidationError, { file: string; success: boolean; error: string | null }>(
    validationErrors,
    concurrency,
    async (issue) => {
      const unit = workUnitById.get(issue.unitId);
      if (!unit) {
        const error = 'Unknown translation work unit';
        progress?.tick(issue.file, false);
        activity?.finishBatch(issue.unitId, false, error);
        return { file: issue.file, success: false, error };
      }

      activity?.startBatch(issue.unitId);

      try {
        const session = await createSession(
          activity
            ? {
                onActivity: (event) => activity.recordSessionEvent(issue.unitId, event),
              }
            : undefined,
        );
        const prompt = buildDocCorrectionPrompt(
          issue.sourceContent,
          issue.translated,
          issue.error,
          issue.languageName,
          issue.locale,
          issue.relativePath,
          extname(issue.relativePath),
        );
        const result = await session.sendPrompt(prompt);
        const corrected = extractText(result);

        if (!corrected) {
          const error = 'No correction returned';
          progress?.tick(issue.file, false);
          activity?.finishBatch(issue.unitId, false, error);
          return { file: issue.file, success: false, error };
        }

        const error = validateTranslatedDoc(corrected, issue.sourceContent, extname(issue.relativePath));
        if (error) {
          progress?.tick(issue.file, false);
          activity?.finishBatch(issue.unitId, false, error);
          return { file: issue.file, success: false, error };
        }

        mkdirSync(dirname(unit.targetPath), { recursive: true });
        writeFileSync(unit.targetPath, corrected);
        onCorrected?.(unit);
        progress?.tick(issue.file, true);
        activity?.finishBatch(issue.unitId, true, 'correction applied');
        return { file: issue.file, success: true, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        progress?.tick(issue.file, false);
        activity?.finishBatch(issue.unitId, false, message);
        return { file: issue.file, success: false, error: message };
      }
    },
  );

  return {
    correctedDocs: retryResults.filter((result) => result.success).length,
    unresolvedFiles: retryResults.filter((result) => !result.success).map((result) => result.file),
    retryResults,
  };
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
  const { contentDir, locales, defaultLocale, extensions, force, provider, cwd = process.cwd() } = options;
  const modeLabel = force ? 'force retranslate' : 'missing or changed docs only';

  ui.header('Translate documentation', 'Live document progress with validation retries and correction timing');

  if (!existsSync(contentDir)) {
    ui.fail(`Content directory not found: ${contentDir}`);
    return 1;
  }

  const sourceFiles = provider
    ? provider.findSourceFiles(contentDir, locales)
    : findFiles(contentDir, extensions, locales);
  if (sourceFiles.length === 0) {
    ui.summary('Docs summary', [
      { label: 'status', value: 'no source docs found', tone: 'warning' },
      { label: 'content dir', value: contentDir },
      { label: 'target locales', value: locales.length },
    ]);
    return 0;
  }

  const docsState = loadDocsState(cwd);
  let docsStateDirty = false;
  const markCurrent = (unit: WorkUnit): void => {
    markTranslationUpToDate(docsState, contentDir, unit);
    docsStateDirty = true;
  };

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
      const relativePath = relative(contentDir, sourcePath);
      const targetPath = provider
        ? provider.resolveTargetPath(sourcePath, contentDir, locale)
        : join(contentDir, locale, relativePath);
      const content = readFileSync(sourcePath, 'utf-8');
      const sourceHash = computeSourceHash(content);
      if (!force && isTranslationUpToDate(docsState, contentDir, locale, relativePath, sourceHash, targetPath)) continue;
      workUnits.push({
        id: `${locale}/${relativePath}`,
        locale,
        languageName,
        relativePath,
        targetPath,
        content,
        sourceHash,
      });
    }
  }

  if (workUnits.length === 0) {
    ui.summary('Docs summary', [
      { label: 'status', value: 'all docs already translated and unchanged', tone: 'success' },
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

  const workUnitById = new Map(workUnits.map((unit) => [unit.id, unit] as const));
  const translateRows: TerminalRow[] = [
    { label: 'source docs', value: sourceFiles.length },
    { label: 'locales active', value: byLocale.size },
    { label: 'concurrency', value: `${concurrency} (${concurrencySource === 'auto' ? 'auto-detected' : 'configured'})` },
  ];

  ui.section('Translate');
  ui.rows(translateRows);

  let translatedDocs = 0;
  let validationErrors: ValidationError[] = [];

  if (interactiveTerminal) {
    let activityError: unknown = null;

    const translationResult = await runTui<TranslationPhaseResult>(({ resolve, requestRender }) => {
      const activity = createTranslateActivityTui(
        { requestRender },
        {
          title: 'LIVE DOCS TRANSLATION',
          activitySectionTitle: 'Document activity',
          idleActivityMessage: 'Waiting for document translation to start…',
        },
      );
      activity.setOverview(translateRows);

      void runDocTranslationWorkUnits(workUnits, concurrency, deps.createSession, null, activity, markCurrent)
        .then((completed) => {
          activity.finish(
            completed.validationErrors.length > 0
              ? 'Initial pass complete. Preparing validation retry…'
              : 'Document translation complete.',
          );
          resolve(completed);
        })
        .catch((error) => {
          activity.finish(
            error instanceof Error
              ? `Document translation failed: ${error.message}`
              : 'Document translation failed.',
          );
          activityError = error;
          resolve(null);
        });

      return activity.root;
    }, { clearOnExit: true, rethrowSignals: true, renderIntervalMs: 1_000 });

    if (activityError) {
      throw activityError;
    }
    if (translationResult == null) {
      return 1;
    }

    translatedDocs = translationResult.translatedDocs;
    validationErrors = translationResult.validationErrors;
  } else {
    const progress = createProgress({
      total: workUnits.length,
      noun: 'docs',
      interactive: false,
      writeLine: logger.log.bind(logger),
    });

    const translationResult = await runDocTranslationWorkUnits(
      workUnits,
      concurrency,
      deps.createSession,
      progress,
      undefined,
      markCurrent,
    );
    progress.done();

    translatedDocs = translationResult.translatedDocs;
    validationErrors = translationResult.validationErrors;
  }

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

    const affectedLocales = new Set(validationErrors.map((issue) => issue.locale)).size;
    const correctionRows: TerminalRow[] = [
      { label: 'affected locales', value: affectedLocales },
      { label: 'concurrency', value: `${concurrency} (${concurrencySource === 'auto' ? 'auto-detected' : 'configured'})` },
    ];

    let correctionResult: CorrectionPhaseResult;

    if (interactiveTerminal) {
      let activityError: unknown = null;

      const completedCorrection = await runTui<CorrectionPhaseResult>(({ resolve, requestRender }) => {
        const activity = createTranslateActivityTui(
          { requestRender },
          {
            title: 'LIVE DOC CORRECTION',
            activitySectionTitle: 'Correction activity',
            idleActivityMessage: 'Waiting for corrections to start…',
          },
        );
        activity.setOverview(correctionRows);

        void runDocCorrectionWorkUnits(
          validationErrors,
          concurrency,
          deps.createSession,
          workUnitById,
          null,
          activity,
          markCurrent,
        )
          .then((completed) => {
            activity.finish(
              completed.unresolvedFiles.length > 0
                ? `${completed.unresolvedFiles.length} documents remain unresolved.`
                : 'Document correction complete.',
            );
            resolve(completed);
          })
          .catch((error) => {
            activity.finish(
              error instanceof Error
                ? `Document correction failed: ${error.message}`
                : 'Document correction failed.',
            );
            activityError = error;
            resolve(null);
          });

        return activity.root;
      }, { clearOnExit: true, rethrowSignals: true, renderIntervalMs: 1_000 });

      if (activityError) {
        throw activityError;
      }
      if (completedCorrection == null) {
        return 1;
      }

      correctionResult = completedCorrection;
    } else {
      const retryProgress = createProgress({
        total: validationErrors.length,
        noun: 'corrections',
        interactive: false,
        writeLine: logger.log.bind(logger),
      });

      correctionResult = await runDocCorrectionWorkUnits(
        validationErrors,
        concurrency,
        deps.createSession,
        workUnitById,
        retryProgress,
        undefined,
        markCurrent,
      );
      retryProgress.done();
    }

    correctedDocs = correctionResult.correctedDocs;
    unresolvedAfterRetry = correctionResult.unresolvedFiles;

    for (const result of correctionResult.retryResults) {
      if (result.success) {
        ui.item(`${result.file} corrected`);
      } else {
        ui.fail(`${result.file}: ${result.error ?? 'unknown error'}`);
      }
    }

    if (unresolvedAfterRetry.length > 0) {
      ui.warn(`${unresolvedAfterRetry.length} docs remain unresolved after retry.`);
    }
  }

  if (docsStateDirty) {
    saveDocsState(cwd, docsState);
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
  const { loadConfig } = await import('../config.js');
  const config = loadConfig();
  const isMock = process.env.TYNDALE_MOCK_TRANSLATE === '1';

  let contentDir: string;
  let provider: import('../docs/types.js').DocsProvider | undefined;

  if (config.docs) {
    const { getDocsProvider } = await import('../docs/providers/index.js');
    provider = getDocsProvider(config.docs.framework);
    contentDir = config.docs.contentDir ?? (provider.framework.id === 'starlight' ? 'src/content/docs' : 'docs');
  } else if (typeof flags['content-dir'] === 'string') {
    contentDir = flags['content-dir'];
  } else {
    // Auto-detect framework from project files
    const { detectDocFrameworks } = await import('../docs/detect.js');
    const detected = detectDocFrameworks(process.cwd());
    if (detected.length === 1 && detected[0].confidence === 'high') {
      const { getDocsProvider } = await import('../docs/providers/index.js');
      provider = getDocsProvider(detected[0].framework.id);
      contentDir = detected[0].contentDir;
    } else {
      contentDir = 'src/content/docs'; // Legacy Starlight default
    }
  }

  // CLI flag overrides config/detection for contentDir
  if (typeof flags['content-dir'] === 'string') {
    contentDir = flags['content-dir'];
  }

  const deps: TranslateDocsDeps = {
    createSession: async (sessionOptions) => {
      if (isMock) {
        const { createMockDocSession } = await import('../translate/mock-docs.js');
        return createMockDocSession();
      }
      const { createTextSession } = await import('../translate/pi-session.js');
      return createTextSession(sessionOptions);
    },
  };

  const options: TranslateDocsOptions = {
    contentDir,
    provider,
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    extensions: provider?.extensions ?? ['.mdx', '.md'],
    concurrency: typeof flags.concurrency === 'string'
      ? parseInt(flags.concurrency, 10)
      : config.translate?.concurrency,
    force: flags.force === true,
    cwd: process.cwd(),
  };

  const exitCode = await handleTranslateDocs(deps, options, console);
  return { exitCode };
}


/** Internal test-only surface. Not part of the public package API. */
export const __testing__ = {
  validateTranslatedDoc,
  validateTranslatedAstro,
  buildDocTranslationPrompt,
  buildDocCorrectionPrompt,
};