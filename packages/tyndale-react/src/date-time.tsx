'use client';

import { useContext } from 'react';
import { TyndaleContext } from './context.js';
import type { DateTimeProps } from './types.js';

/**
 * Locale-aware date/time formatter.
 * Standalone: renders formatted date. Inside <T>: serialized as {name}.
 */
export function DateTime({ value, options }: DateTimeProps): React.JSX.Element {
  const ctx = useContext(TyndaleContext);
  const locale = ctx?.locale ?? 'en';
  const date = value instanceof Date ? value : new Date(value);
  const formatted = new Intl.DateTimeFormat(locale, options).format(date);
  return <>{formatted}</>;
}
