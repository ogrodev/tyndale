import { getTranslation } from 'tyndale-react/server';

// Keep in sync with `locales` in tyndale.config.json (excludes defaultLocale "en").
export const supportedLocales = ['es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'it', 'ru'] as const;

/**
 * Async t() builder for Astro frontmatter.
 *
 * Delegates to `tyndale-react/server`'s `getTranslation`, which loads
 * `public/_tyndale/{locale}.json` and looks up entries by SHA-256 hash of the
 * whitespace-normalized source — the same keying the Tyndale CLI emits.
 */
export function createT(locale: string) {
  return getTranslation({
    locale,
    defaultLocale: 'en',
    outputPath: 'public/_tyndale',
  });
}
