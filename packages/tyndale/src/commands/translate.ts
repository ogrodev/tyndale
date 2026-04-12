// packages/tyndale/src/commands/translate.ts
import type { CommandResult } from '../cli';
import { join } from 'path';
import { computeDelta, type Manifest, type LocaleData } from '../translate/delta';
import { splitIntoBatches, translateBatch, type TranslationSession } from '../translate/batch-translator';
import { readLocaleFile, writeLocaleFile } from '../translate/locale-writer';
import { withRetry } from '../translate/retry';

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
  batchSize?: number;
  dryRun?: boolean;
}

/** Injectable dependencies for testability. */
export interface TranslateDeps {
  outputDir: string;
  createSession: () => Promise<TranslationSession>;
}

/**
 * Main translate command handler.
 *
 * 1. Load manifest and default locale data
 * 2. For each target locale, compute delta
 * 3. If dry-run, report and exit
 * 4. Batch-translate new entries via Pi session
 * 5. Write updated locale files
 * 6. Report results; exit 1 on any failure but preserve successful work
 */
export async function handleTranslate(
  deps: TranslateDeps,
  options: TranslateOptions,
  logger: Logger,
): Promise<number> {
  const { outputDir, createSession } = deps;
  const batchSize = options.batchSize ?? 50;

  // Load manifest
  const manifestPath = join(outputDir, 'manifest.json');
  const manifest: Manifest = JSON.parse(
    await Bun.file(manifestPath).text(),
  );

  // Load default locale data (source strings)
  const defaultLocalePath = join(outputDir, `${manifest.defaultLocale}.json`);
  const defaultLocaleData: LocaleData = JSON.parse(
    await Bun.file(defaultLocalePath).text(),
  );

  // Determine target locales
  const targetLocales = options.locale
    ? [options.locale]
    : manifest.locales;

  let hasFailure = false;

  for (const locale of targetLocales) {
    const localePath = join(outputDir, `${locale}.json`);
    const existingData = await readLocaleFile(localePath);

    const delta = computeDelta(manifest, defaultLocaleData, existingData, {
      force: options.force,
    });

    logger.log(
      `${locale}: ${delta.newHashes.length} new, ${delta.staleHashes.length} stale`,
    );

    // Dry run: report only
    if (options.dryRun) {
      if (delta.newEntries.length > 0) {
        for (const entry of delta.newEntries) {
          logger.log(`  [new] ${entry.hash} — ${entry.source.slice(0, 60)}`);
        }
      }
      continue;
    }

    // Nothing to translate and nothing stale — skip
    if (delta.newHashes.length === 0 && delta.staleHashes.length === 0) {
      logger.log(`${locale}: up to date`);
      continue;
    }

    // If only stale (no new), just clean up
    if (delta.newHashes.length === 0) {
      await writeLocaleFile(localePath, existingData, {}, delta.staleHashes);
      logger.log(`\u2713 ${locale}: removed ${delta.staleHashes.length} stale entries`);
      continue;
    }

    // Translate new entries
    const languageName = getLanguageName(locale);
    const batches = splitIntoBatches(delta.newEntries, batchSize);
    const allTranslations: Record<string, string> = {};
    const allFailed: string[] = [];

    try {
      const session = await createSession();

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const result = await withRetry(
          () => translateBatch(session, batch, locale, languageName),
          {
            maxAttempts: 3,
            baseDelayMs: 1000,
            onRetry: (attempt, err) => {
              logger.log(`  Retry ${attempt}/3 for ${locale} batch ${i + 1}: ${err.message}`);
            },
          },
        );

        Object.assign(allTranslations, result.translations);
        allFailed.push(...result.failedHashes);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`${locale}: translation failed — ${msg}`);
      hasFailure = true;
      continue;
    }

    // Write results
    await writeLocaleFile(localePath, existingData, allTranslations, delta.staleHashes);

    const successCount = Object.keys(allTranslations).length;
    logger.log(`\u2713 ${locale}: ${successCount} entries translated`);

    if (allFailed.length > 0) {
      logger.error(`${locale}: ${allFailed.length} entries failed validation`);
      hasFailure = true;
    }
  }

  return hasFailure ? 1 : 0;
}

/** CLI entry point for `tyndale translate` */
export async function runTranslate(flags: Record<string, string | boolean>): Promise<CommandResult> {
  const { loadConfig } = await import('../config');

  const config = await loadConfig();
  const isMock = process.env.TYNDALE_MOCK_TRANSLATE === '1';

  const deps: TranslateDeps = {
    outputDir: config.output ?? 'public/_tyndale',
    createSession: async () => {
      if (isMock) {
        const { createMockSession } = await import('../translate/mock');
        return createMockSession();
      }
      const { createTranslationSession } = await import('../translate/pi-session');
      return createTranslationSession();
    },
  };

  const translateOpts: TranslateOptions = {
    locale: typeof flags.locale === 'string' ? flags.locale : undefined,
    force: flags.force === true,
    batchSize: typeof flags['batch-size'] === 'string' ? parseInt(flags['batch-size'], 10) : config.batchSize,
    dryRun: flags['dry-run'] === true,
  };

  const exitCode = await handleTranslate(deps, translateOpts, console);
  return { exitCode };
}
