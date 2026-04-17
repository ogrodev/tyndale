// packages/tyndale/src/translate/batch-translator.ts
import { buildTranslationPrompt, parseTranslationResult } from './pi-session.js';
import { validateTranslation } from './wire-validator.js';

export type { TranslationInput } from './pi-session.js';
import type { TranslationInput } from './pi-session.js';

/** Minimal session interface for testability — real Pi session satisfies this. */
export interface TranslationSession {
  sendPrompt(prompt: string): Promise<unknown>;
}

export interface BatchResult {
  translations: Record<string, string>;
  failedHashes: string[];
}

export type TranslateBatchPhase =
  | { type: 'awaiting_response'; attempt: 'initial' | 'retry'; totalEntries: number }
  | { type: 'validating'; attempt: 'initial' | 'retry'; totalEntries: number }
  | { type: 'retrying'; retryEntries: number; totalEntries: number };

export interface TranslateBatchObserver {
  onPhase?(phase: TranslateBatchPhase): void;
}


/**
 * Translates a batch of entries via the Pi session.
 *
 * Steps:
 * 1. Send prompt with all entries
 * 2. Parse structured result
 * 3. Validate each translation against its source wire format
 * 4. For invalid entries, retry once with error-correction prompt
 * 5. Return valid translations + list of hashes that failed all attempts
 */
export async function translateBatch(
  session: TranslationSession,
  entries: TranslationInput[],
  localeCode: string,
  languageName: string,
  brief?: string,
  observer?: TranslateBatchObserver,
 ): Promise<BatchResult> {
  const translations: Record<string, string> = {};
  const failedHashes: string[] = [];

  // First attempt
  const prompt = buildTranslationPrompt(entries, localeCode, languageName, brief);
  observer?.onPhase?.({ type: 'awaiting_response', attempt: 'initial', totalEntries: entries.length });
  const rawResult = await session.sendPrompt(prompt);
  const parsed = parseTranslationResult(rawResult);

  if (!parsed) {
    // Complete failure — all hashes failed
    return { translations: {}, failedHashes: entries.map((e) => e.hash) };
  }

  // Validate each translation
  const needsRetry: TranslationInput[] = [];
  observer?.onPhase?.({ type: 'validating', attempt: 'initial', totalEntries: entries.length });

  for (const entry of entries) {
    const translated = parsed[entry.hash];
    if (!translated) {
      needsRetry.push(entry);
      continue;
    }

    const validation = validateTranslation(entry.source, translated);
    if (validation.valid) {
      translations[entry.hash] = translated;
    } else {
      needsRetry.push(entry);
    }
  }

  // Retry invalid entries once with error-correction prompt
  if (needsRetry.length > 0) {
    observer?.onPhase?.({
      type: 'retrying',
      retryEntries: needsRetry.length,
      totalEntries: entries.length,
    });
    const retryPrompt = buildErrorCorrectionPrompt(needsRetry, parsed, localeCode, languageName, brief);
    observer?.onPhase?.({ type: 'awaiting_response', attempt: 'retry', totalEntries: needsRetry.length });
    const retryRaw = await session.sendPrompt(retryPrompt);
    const retryParsed = parseTranslationResult(retryRaw);
    observer?.onPhase?.({ type: 'validating', attempt: 'retry', totalEntries: needsRetry.length });

    for (const entry of needsRetry) {
      const retranslated = retryParsed?.[entry.hash];
      if (retranslated) {
        const validation = validateTranslation(entry.source, retranslated);
        if (validation.valid) {
          translations[entry.hash] = retranslated;
          continue;
        }
      }
      failedHashes.push(entry.hash);
    }
  }

  return { translations, failedHashes };
}

/** Builds an error-correction prompt for entries that failed validation. */
function buildErrorCorrectionPrompt(
  entries: TranslationInput[],
  previousTranslations: Record<string, string>,
  localeCode: string,
  languageName: string,
  brief?: string,
): string {
  const details = entries
    .map((e) => {
      const prev = previousTranslations[e.hash];
      const validation = prev ? validateTranslation(e.source, prev) : null;
      const errorDetail = validation ? validation.errors.join('; ') : 'No translation provided';

      return `  "${e.hash}": {
    "source": "${e.source}",
    "previous_translation": ${prev ? `"${prev}"` : 'null'},
    "errors": "${errorDetail}"
  }`;
    })
    .join(',\n');

  const briefSection = brief
    ? `\nTRANSLATION BRIEF:\n${brief}\n`
    : '';

  return `Your previous translations for ${languageName} (${localeCode}) had errors. Please fix them.

ERRORS TO FIX:
{
${details}
}
${briefSection}
RULES (same as before):
1. Preserve ALL numbered tags: <0>, </0>, <1>, </1>, etc.
2. Preserve ALL variable placeholders: {name}, {count}, etc.
3. Every <N> must have a matching </N>.
4. Do NOT invent new tags or placeholders.

Respond with:
{
  "translations": {
    "<hash>": "<corrected translation>",
    ...
  }
}`;
}
