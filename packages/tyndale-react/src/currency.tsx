'use client';

import { useContext } from 'react';
import { TyndaleContext } from './context.js';
import type { CurrencyProps } from './types.js';

/**
 * Locale-aware currency formatter.
 * Standalone: renders formatted currency. Inside <T>: serialized as {name}.
 */
export function Currency({
  value,
  currency,
  options,
}: CurrencyProps): React.JSX.Element {
  const ctx = useContext(TyndaleContext);
  const locale = ctx?.locale ?? 'en';
  const formatted = new Intl.NumberFormat(locale, {
    ...options,
    style: 'currency',
    currency,
  }).format(value);
  return <>{formatted}</>;
}
