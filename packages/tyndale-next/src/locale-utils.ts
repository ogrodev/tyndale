/**
 * BCP 47 primary language subtags for right-to-left scripts.
 * Includes the major RTL languages plus less common ones.
 */
const RTL_LOCALES = new Set([
  'ar',   // Arabic
  'he',   // Hebrew
  'fa',   // Farsi/Persian
  'ur',   // Urdu
  'ps',   // Pashto
  'yi',   // Yiddish
  'arc',  // Aramaic
  'arz',  // Egyptian Arabic
  'ckb',  // Central Kurdish (Sorani)
  'dv',   // Divehi/Maldivian
  'ha',   // Hausa (Ajami script)
  'khw',  // Khowar
  'ks',   // Kashmiri
  'ku',   // Kurdish
  'sd',   // Sindhi
  'syr',  // Syriac
  'ug',   // Uyghur
]);

/**
 * Extracts the primary language subtag from a BCP 47 locale string.
 * "ar-SA" → "ar", "en" → "en", "zh-Hant" → "zh"
 */
function primarySubtag(locale: string): string {
  const idx = locale.indexOf('-');
  return idx === -1 ? locale : locale.slice(0, idx);
}

/**
 * Returns true if the locale uses a right-to-left script.
 * Checks the primary language subtag against the known RTL set.
 * Also checks the full locale string for multi-segment RTL codes (e.g. "arc").
 */
export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(locale) || RTL_LOCALES.has(primarySubtag(locale));
}

/**
 * Returns 'rtl' or 'ltr' for the given locale.
 */
export function getDirection(locale: string): 'ltr' | 'rtl' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * Resolves a locale through the alias map.
 * Returns the canonical locale if an alias exists, otherwise the original.
 */
export function resolveAlias(
  locale: string,
  aliases: Record<string, string>,
): string {
  return aliases[locale] ?? locale;
}

interface ParsedLocale {
  code: string;
  quality: number;
}

/**
 * Parses an Accept-Language header into an ordered list of locale codes.
 * Sorted by quality factor (highest first). Wildcard (*) is ignored.
 *
 * Example: "fr;q=0.8, en;q=0.9, es;q=0.7" → ["en", "fr", "es"]
 */
export function parseAcceptLanguage(header: string): string[] {
  if (!header.trim()) return [];

  const parsed: ParsedLocale[] = [];

  for (const part of header.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const [rawCode, ...params] = trimmed.split(';');
    const code = rawCode.trim();

    if (code === '*') continue;

    let quality = 1.0;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key.trim() === 'q' && value) {
        quality = parseFloat(value);
      }
    }

    parsed.push({ code, quality });
  }

  parsed.sort((a, b) => b.quality - a.quality);
  return parsed.map((p) => p.code);
}
