'use client';

import { useCallback, useRef } from 'react';
import { useTyndaleInternalContext } from './internal-context.js';

/**
 * Returns a function that triggers a locale change.
 *
 * Plain React behavior:
 * 1. Aborts any in-flight locale fetch (AbortController)
 * 2. Fetches new locale JSON
 * 3. On success, updates context state and calls onLocaleChange
 *
 * Last-write-wins: if multiple calls overlap, only the most recent
 * fetch takes effect. Earlier fetches are aborted.
 */
export function useChangeLocale(): (locale: string) => void {
  const { setLocaleData, onLocaleChange, outputPath } =
    useTyndaleInternalContext();
  const abortRef = useRef<AbortController | null>(null);

  return useCallback(
    (newLocale: string) => {
      // Abort any in-flight fetch
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`${outputPath}/${newLocale}.json`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} loading ${newLocale}.json`);
          }
          return response.json() as Promise<Record<string, string>>;
        })
        .then((translations) => {
          if (!controller.signal.aborted) {
            setLocaleData(newLocale, translations);
            onLocaleChange?.(newLocale);
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            console.error(
              `[tyndale] Failed to load locale "${newLocale}":`,
              err,
            );
          }
        });
    },
    [setLocaleData, onLocaleChange, outputPath],
  );
}
