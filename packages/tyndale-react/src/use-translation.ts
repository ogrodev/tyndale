import { useContext, useCallback } from 'react';
import { TyndaleContext } from './context';
import { hash } from './hash';

/**
 * Interpolates {name} placeholders in a string with provided values.
 * Unmatched placeholders are left as-is.
 */
export function interpolate(
  text: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in vars) return String(vars[key]);
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[tyndale] Missing variable "${key}" in translation interpolation`);
    }
    return match; // leave placeholder as-is
  });
}

/**
 * Client hook for string translation.
 * Returns t(source, vars?) that hashes source, looks up translation,
 * applies interpolation, and falls back to source.
 */
export function useTranslation(): (
  source: string,
  vars?: Record<string, string | number>,
) => string {
  const ctx = useContext(TyndaleContext);

  return useCallback(
    (source: string, vars?: Record<string, string | number>): string => {
      const h = hash(source);
      const translated = ctx?.translations[h];
      const result = translated ?? source;
      return interpolate(result, vars);
    },
    [ctx?.translations],
  );
}
