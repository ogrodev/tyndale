import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { TyndaleContext } from './context';
import type { LocaleData, Manifest, TyndaleContextValue } from './types';
import { TyndaleInternalContext, type TyndaleInternalContextValue } from './internal-context';

export interface TyndaleProviderProps {
  /** The source locale the app is written in. */
  defaultLocale: string;
  /** Initial locale to display. Defaults to `defaultLocale`. */
  locale?: string;
  /** Base path for locale files. Defaults to '/_tyndale'. */
  basePath?: string;
  /** Pre-loaded translations (for SSR/testing). Skips fetch when provided. */
  initialTranslations?: Record<string, string>;
  /** Pre-loaded manifest (for SSR/testing). */
  initialManifest?: Manifest | null;
  /** Called when the locale changes (for controlled mode). */
  onLocaleChange?: (locale: string) => void;
  children: ReactNode;
}

/**
 * Context provider that loads locale data and exposes it to descendants.
 *
 * Behavior:
 * - Fetches `{basePath}/{locale}.json` and `{basePath}/manifest.json`
 * - Renders children as-is during loading (graceful fallback to source content)
 * - On fetch error, falls back to source content and logs a console warning
 * - Provides TyndaleInternalContext for useChangeLocale() hook
 */
export function TyndaleProvider({
  defaultLocale,
  locale: localeProp,
  basePath = '/_tyndale',
  initialTranslations,
  initialManifest,
  onLocaleChange,
  children,
}: TyndaleProviderProps) {
  const [locale, setLocale] = useState(localeProp ?? defaultLocale);
  const [translations, setTranslations] = useState<LocaleData>(
    initialTranslations ?? {},
  );
  const [manifest, setManifest] = useState<Manifest | null>(
    initialManifest ?? null,
  );
  const [isLoading, setIsLoading] = useState(!initialTranslations);

  // Sync controlled locale prop
  useEffect(() => {
    if (localeProp !== undefined && localeProp !== locale) {
      setLocale(localeProp);
    }
  }, [localeProp]);

  // Load translations when locale changes (skip if pre-loaded)
  useEffect(() => {
    if (initialTranslations) return;

    const controller = new AbortController();
    setIsLoading(true);

    Promise.all([
      fetch(`${basePath}/${locale}.json`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => data as Record<string, string>),
      manifest
        ? Promise.resolve(manifest)
        : fetch(`${basePath}/manifest.json`, { signal: controller.signal })
            .then((r) => r.json())
            .catch(() => null),
    ])
      .then(([trans, man]) => {
        if (!controller.signal.aborted) {
          setTranslations(trans);
          if (man) setManifest(man);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn(`[tyndale] Failed to load locale "${locale}":`, err.message);
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [locale, basePath, initialTranslations]);

  const setLocaleData = useCallback(
    (newLocale: string, newTranslations: Record<string, string>) => {
      setLocale(newLocale);
      setTranslations(newTranslations);
    },
    [],
  );

  const changeLocale = useCallback((newLocale: string) => {
    setLocale(newLocale);
    onLocaleChange?.(newLocale);
  }, [onLocaleChange]);

  const ctxValue = useMemo<TyndaleContextValue>(
    () => ({ locale, defaultLocale, translations, manifest, isLoading, changeLocale }),
    [locale, defaultLocale, translations, manifest, isLoading, changeLocale],
  );

  const internalValue = useMemo<TyndaleInternalContextValue>(
    () => ({ setLocaleData, onLocaleChange, outputPath: basePath }),
    [setLocaleData, onLocaleChange, basePath],
  );

  return (
    <TyndaleContext value={ctxValue}>
      <TyndaleInternalContext.Provider value={internalValue}>
        {children}
      </TyndaleInternalContext.Provider>
    </TyndaleContext>
  );
}
