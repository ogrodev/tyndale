// packages/tyndale/src/commands/translate.ts
import type { CommandResult } from '../cli';
import { join } from 'path';
import { computeDelta, type Manifest, type LocaleData } from '../translate/delta';
import { translateBatch, type TranslationSession } from '../translate/batch-translator';
import { readLocaleFile, writeLocaleFile } from '../translate/locale-writer';
import { withRetry } from '../translate/retry';
import { splitByTokenBudget, type TokenBatch } from '../translate/token-batcher';
import { loadBrief, saveBrief, sampleEntriesForBrief, buildBriefGenerationPrompt } from '../translate/brief';
import { resolveConcurrency } from '../translate/concurrency';
import { runPool } from '../translate/pool';
import type { TranslationInput } from '../translate/pi-session';
import { createProgress, createTerminalUi, type TerminalRow } from '../terminal/ui';

/** Locale code → full language name for prompt context. */
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

export interface TranslateOptions {
  locale?: string;
  force?: boolean;
  tokenBudget?: number;
  concurrency?: number;
  dryRun?: boolean;
}

/** Injectable dependencies for testability. */
export interface TranslateDeps {
  outputDir: string;
  projectRoot: string;
  /** Creates a JSON-mode session (for string translation). */
  createSession: () => Promise<TranslationSession>;
  /** Creates a text-mode session (for brief generation). */
  createBriefSession?: () => Promise<TranslationSession>;
}

/** A single unit of work: one batch for one locale. */
interface WorkUnit {
  locale: string;
  languageName: string;
  batch: TokenBatch;
  batchIndex: number;
  brief: string | undefined;
}

/** Result of a single work unit execution. */
interface WorkUnitResult {
  locale: string;
  translations: Record<string, string>;
  failedHashes: string[];
}

/**
 * Main translate command handler.
 *
 * 1. Load manifest and default locale data
 * 2. For each target locale, compute delta and load/generate brief
 * 3. If dry-run, report and exit
 * 4. Split entries into token-based batches
 * 5. Translate all work units in parallel
 * 6. Merge results per locale and write files
 * 7. Report results; exit 1 on any failure but preserve successful work
 */
export async function handleTranslate(
  deps: TranslateDeps,
  options: TranslateOptions,
  logger: Logger,
): Promise<number> {
  const { outputDir, projectRoot, createSession } = deps;
  const isConsoleLogger = logger === console;
  const interactiveTerminal = isConsoleLogger && process.stdout.isTTY === true;
  const ui = createTerminalUi({
    write: logger.log.bind(logger),
    error: logger.error.bind(logger),
    decorated: interactiveTerminal,
  });
  const tokenBudget = options.tokenBudget ?? 50_000;
  const modeLabel = options.dryRun
    ? 'dry run'
    : options.force
      ? 'force retranslate'
      : 'delta only';

  const manifestPath = join(outputDir, 'manifest.json');
  const manifest: Manifest = JSON.parse(await Bun.file(manifestPath).text());

  const defaultLocalePath = join(outputDir, `${manifest.defaultLocale}.json`);
  const defaultLocaleData: LocaleData = JSON.parse(await Bun.file(defaultLocalePath).text());

  const targetLocales = options.locale ? [options.locale] : manifest.locales;

  ui.header('Translate source strings', 'Live batch progress with per-locale status and timing');
  ui.section('Preflight');
  ui.rows([
    { label: 'source locale', value: manifest.defaultLocale },
    { label: 'target locales', value: targetLocales.join(', ') || 'none' },
    { label: 'token budget', value: tokenBudget.toLocaleString() },
    { label: 'mode', value: modeLabel },
  ]);

  let hasFailure = false;
  let totalNewEntries = 0;
  let totalStaleHashes = 0;
  const deltaRows: TerminalRow[] = [];
  const dryRunDetails: string[] = [];

  const localeState = new Map<string, {
    existingData: LocaleData;
    newEntries: TranslationInput[];
    staleHashes: string[];
  }>();

  for (const locale of targetLocales) {
    const localePath = join(outputDir, `${locale}.json`);
    const existingData = await readLocaleFile(localePath);
    const delta = computeDelta(manifest, defaultLocaleData, existingData, {
      force: options.force,
    });

    totalNewEntries += delta.newEntries.length;
    totalStaleHashes += delta.staleHashes.length;
    deltaRows.push({
      label: locale,
      value: `${delta.newEntries.length} new, ${delta.staleHashes.length} stale${delta.newEntries.length === 0 && delta.staleHashes.length === 0 ? ', up to date' : ''}`,
    });

    localeState.set(locale, {
      existingData,
      newEntries: delta.newEntries,
      staleHashes: delta.staleHashes,
    });

    if (options.dryRun) {
      for (const entry of delta.newEntries) {
        dryRunDetails.push(`[new] ${locale} ${entry.hash} — ${entry.source.slice(0, 60)}`);
      }
    }
  }

  ui.section('Delta');
  ui.rows(deltaRows);

  if (options.dryRun) {
    if (dryRunDetails.length > 0) {
      ui.section('Dry run preview');
      for (const detail of dryRunDetails) {
        ui.item(detail);
      }
    } else {
      ui.info('No new entries need translation.');
    }

    ui.summary('Dry run summary', [
      { label: 'new entries', value: totalNewEntries },
      { label: 'stale hashes', value: totalStaleHashes },
      { label: 'target locales', value: targetLocales.length },
    ]);
    return 0;
  }

  const workUnits: WorkUnit[] = [];
  const briefs = new Map<string, string | undefined>();
  const localesToTranslate: string[] = [];
  let upToDateLocales = 0;
  let staleOnlyLocales = 0;

  for (const locale of targetLocales) {
    const state = localeState.get(locale)!;

    if (state.newEntries.length === 0 && state.staleHashes.length === 0) {
      upToDateLocales++;
      continue;
    }

    if (state.newEntries.length === 0) {
      const localePath = join(outputDir, `${locale}.json`);
      await writeLocaleFile(localePath, state.existingData, {}, state.staleHashes);
      staleOnlyLocales++;
      ui.item(`${locale}: removed ${state.staleHashes.length} stale entries`);
      continue;
    }

    localesToTranslate.push(locale);
  }

  ui.section('Execution plan');
  ui.rows([
    { label: 'work locales', value: localesToTranslate.length },
    { label: 'up to date', value: upToDateLocales },
    { label: 'stale cleanup', value: staleOnlyLocales },
    { label: 'new entries', value: totalNewEntries },
  ]);

  let existingBriefs = 0;
  let generatedBriefs = 0;
  let skippedBriefs = 0;

  if (localesToTranslate.length > 0) {
    const localesNeedingBriefs = localesToTranslate.filter(
      (locale) => loadBrief(projectRoot, locale) === null,
    );

    for (const locale of localesToTranslate) {
      const existing = loadBrief(projectRoot, locale);
      if (existing) {
        briefs.set(locale, existing);
        existingBriefs++;
      }
    }

    ui.section('Translation briefs');
    ui.rows([
      { label: 'existing', value: existingBriefs },
      { label: 'to generate', value: localesNeedingBriefs.length },
    ]);

    if (localesNeedingBriefs.length > 0) {
      await runPool(localesNeedingBriefs, Math.min(localesNeedingBriefs.length, 4), async (locale) => {
        const state = localeState.get(locale)!;
        const languageName = getLanguageName(locale);
        try {
          const samples = sampleEntriesForBrief(state.newEntries);
          const briefPrompt = buildBriefGenerationPrompt(
            samples,
            locale,
            languageName,
            manifest.defaultLocale,
          );
          const briefSessionFactory = deps.createBriefSession ?? createSession;
          const session = await briefSessionFactory();
          const result = await session.sendPrompt(briefPrompt);
          const brief = typeof result === 'string' ? result : null;
          if (brief) {
            saveBrief(projectRoot, locale, brief);
            briefs.set(locale, brief);
            generatedBriefs++;
            ui.item(`${locale}: generated translation brief`);
            return;
          }
        } catch {
          // Briefs are optional; fall through to a visible skip marker.
        }

        skippedBriefs++;
        ui.warn(`${locale}: brief generation skipped`);
      });
    }
  }

  for (const locale of localesToTranslate) {
    const state = localeState.get(locale)!;
    const languageName = getLanguageName(locale);
    const batches = splitByTokenBudget(state.newEntries, tokenBudget);
    for (let i = 0; i < batches.length; i++) {
      workUnits.push({
        locale,
        languageName,
        batch: batches[i],
        batchIndex: i,
        brief: briefs.get(locale),
      });
    }
  }

  if (workUnits.length === 0) {
    ui.summary('Translate summary', [
      { label: 'status', value: 'no translation work remaining', tone: 'success' },
      { label: 'target locales', value: targetLocales.length },
      { label: 'briefs created', value: generatedBriefs },
      { label: 'briefs skipped', value: skippedBriefs },
    ]);
    return 0;
  }

  const { value: concurrency, source: concurrencySource } = resolveConcurrency(options.concurrency);
  ui.section('Translate');
  ui.rows([
    { label: 'batches', value: workUnits.length },
    { label: 'concurrency', value: `${concurrency} (${concurrencySource === 'auto' ? 'auto-detected' : 'configured'})` },
    { label: 'briefs created', value: generatedBriefs },
    { label: 'briefs skipped', value: skippedBriefs },
  ]);

  const progress = createProgress({
    total: workUnits.length,
    noun: 'batches',
    interactive: interactiveTerminal,
    decorated: interactiveTerminal,
    writeLine: interactiveTerminal ? undefined : logger.log.bind(logger),
  });

  const results = await runPool<WorkUnit, WorkUnitResult>(
    workUnits,
    concurrency,
    async (unit) => {
      try {
        const session = await createSession();
        const result = await withRetry(
          () => translateBatch(session, unit.batch.entries, unit.locale, unit.languageName, unit.brief),
          {
            maxAttempts: 3,
            baseDelayMs: 1000,
            onRetry: (attempt, err) => {
              ui.warn(`Retry ${attempt}/3 for ${unit.locale} batch ${unit.batchIndex + 1} — ${err.message}`);
            },
          },
        );

        progress.tick(`${unit.locale} batch ${unit.batchIndex + 1}`, result.failedHashes.length === 0);
        return {
          locale: unit.locale,
          translations: result.translations,
          failedHashes: result.failedHashes,
        };
      } catch {
        progress.tick(`${unit.locale} batch ${unit.batchIndex + 1}`, false);
        return {
          locale: unit.locale,
          translations: {},
          failedHashes: unit.batch.entries.map((entry) => entry.hash),
        };
      }
    },
  );

  progress.done();

  let translatedEntries = 0;
  let failedHashes = 0;

  ui.section('Apply results');
  for (const locale of targetLocales) {
    const state = localeState.get(locale);
    if (!state || (state.newEntries.length === 0 && state.staleHashes.length === 0)) continue;
    if (state.newEntries.length === 0) continue;

    const localeResults = results.filter((result) => result.locale === locale);
    const allTranslations: Record<string, string> = {};
    const allFailed: string[] = [];

    for (const result of localeResults) {
      Object.assign(allTranslations, result.translations);
      allFailed.push(...result.failedHashes);
    }

    const localePath = join(outputDir, `${locale}.json`);
    await writeLocaleFile(localePath, state.existingData, allTranslations, state.staleHashes);

    const successCount = Object.keys(allTranslations).length;
    translatedEntries += successCount;
    failedHashes += allFailed.length;
    ui.item(`${locale}: translated ${successCount} entries`);

    if (allFailed.length > 0) {
      ui.fail(`${locale}: ${allFailed.length} entries failed validation`);
      hasFailure = true;
    }
  }

  ui.summary('Translate summary', [
    { label: 'status', value: hasFailure ? 'completed with failures' : 'completed', tone: hasFailure ? 'failure' : 'success' },
    { label: 'target locales', value: targetLocales.length },
    { label: 'translated', value: translatedEntries },
    { label: 'failed hashes', value: failedHashes, tone: failedHashes > 0 ? 'failure' : 'muted' },
    { label: 'stale hashes', value: totalStaleHashes, tone: totalStaleHashes > 0 ? 'warning' : 'muted' },
  ]);

  return hasFailure ? 1 : 0;
}

/** CLI entry point for `tyndale translate` */
export async function runTranslate(flags: Record<string, string | boolean>): Promise<CommandResult> {
  const { runExtract } = await import('./extract');
  const extractResult = await runExtract({});
  if (extractResult.exitCode !== 0) {
    console.error('Extract failed — aborting translate.');
    return extractResult;
  }

  const { loadConfig } = await import('../config');

  const config = loadConfig();
  const isMock = process.env.TYNDALE_MOCK_TRANSLATE === '1';

  const deps: TranslateDeps = {
    outputDir: config.output ?? 'public/_tyndale',
    projectRoot: process.cwd(),
    createSession: async () => {
      if (isMock) {
        const { createMockSession } = await import('../translate/mock');
        return createMockSession();
      }
      const { createTranslationSession } = await import('../translate/pi-session');
      return createTranslationSession();
    },
    createBriefSession: async () => {
      if (isMock) {
        const { createMockDocSession } = await import('../translate/mock-docs');
        return createMockDocSession();
      }
      const { createTextSession } = await import('../translate/pi-session');
      return createTextSession();
    },
  };

  const translateOpts: TranslateOptions = {
    locale: typeof flags.locale === 'string' ? flags.locale : undefined,
    force: flags.force === true,
    tokenBudget: typeof flags['token-budget'] === 'string'
      ? parseInt(flags['token-budget'], 10)
      : config.translate?.tokenBudget,
    concurrency: typeof flags.concurrency === 'string'
      ? parseInt(flags.concurrency, 10)
      : config.translate?.concurrency,
    dryRun: flags['dry-run'] === true,
  };

  const exitCode = await handleTranslate(deps, translateOpts, console);
  return { exitCode };
}
