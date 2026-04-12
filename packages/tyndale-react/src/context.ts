import { createContext, useContext } from 'react';
import type { TyndaleContextValue, Manifest, ManifestEntry } from './types.js';

// Re-export types that tests and consumers import from context
export type { TyndaleContextValue, ManifestEntry } from './types.js';
export type { Manifest as TyndaleManifest } from './types.js';

/**
 * React context for Tyndale i18n state.
 * `null` when no provider is mounted — consumers must handle this gracefully.
 */
export const TyndaleContext = createContext<TyndaleContextValue | null>(null);

TyndaleContext.displayName = 'TyndaleContext';

/**
 * Hook that reads the Tyndale context, throwing if no provider is mounted.
 * Use this in hooks/components that require a provider.
 */
export function useTyndaleContext(): TyndaleContextValue {
  const ctx = useContext(TyndaleContext);
  if (!ctx) {
    throw new Error('useTyndaleContext must be used within a TyndaleProvider');
  }
  return ctx;
}