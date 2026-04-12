import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hash } from './hash';
import { interpolate } from './use-translation';

export interface GetTranslationOptions {
  /** Target locale code. */
  locale: string;
  /** Default locale code. If locale === defaultLocale, skip file loading. */
  defaultLocale?: string;
  /** Absolute or relative path to the directory containing locale JSON files. */
  outputPath: string;
}

type TranslationFn = (
  source: string,
  vars?: Record<string, string | number>,
) => string;

/**
 * Server-side async translation function.
 * Loads the locale file from disk and returns a t() function.
 */
export async function getTranslation(
  options: GetTranslationOptions,
): Promise<TranslationFn> {
  const { locale, defaultLocale, outputPath } = options;

  // For the default locale, source strings are the translation
  if (locale === defaultLocale) {
    return (source, vars) => interpolate(source, vars);
  }

  let translations: Record<string, string> = {};
  try {
    const filePath = join(outputPath, `${locale}.json`);
    const content = await readFile(filePath, 'utf-8');
    translations = JSON.parse(content);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[tyndale] Failed to load locale file for "${locale}":`,
        (err as Error).message,
      );
    }
  }

  return (source: string, vars?: Record<string, string | number>): string => {
    const h = hash(source);
    const translated = translations[h] ?? source;
    return interpolate(translated, vars);
  };
}
