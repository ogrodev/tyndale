import { useContext } from 'react';
import { TyndaleContext } from './context.js';

/**
 * Returns the current locale string from the nearest TyndaleProvider.
 *
 * If used outside a TyndaleProvider, logs a warning and returns an empty string.
 * This is intentional graceful degradation — components render without crashing.
 */
export function useLocale(): string {
  const ctx = useContext(TyndaleContext);

  if (!ctx) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[tyndale] useLocale() called outside a <TyndaleProvider>. ' +
        'Wrap your app in <TyndaleProvider> to use translations.'
      );
    }
    return '';
  }

  return ctx.locale;
}
