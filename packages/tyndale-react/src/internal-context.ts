'use client';

import { createContext, useContext } from 'react';

export interface TyndaleInternalContextValue {
  /** Update locale and translations in provider state. */
  setLocaleData: (locale: string, translations: Record<string, string>) => void;
  /** Called after locale change succeeds. Framework adapters override this. */
  onLocaleChange?: (locale: string) => void;
  /** Base path for locale files, e.g. '/_tyndale'. */
  outputPath: string;
}

export const TyndaleInternalContext =
  createContext<TyndaleInternalContextValue | null>(null);

export function useTyndaleInternalContext(): TyndaleInternalContextValue {
  const ctx = useContext(TyndaleInternalContext);
  if (!ctx) {
    throw new Error(
      'useTyndaleInternalContext must be used within a TyndaleProvider',
    );
  }
  return ctx;
}
