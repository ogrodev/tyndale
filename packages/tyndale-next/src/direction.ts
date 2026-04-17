// packages/tyndale-next/src/direction.ts
import { useLocale } from 'tyndale-react';
import { getDirection } from './locale-utils.js';

/**
 * Returns the text direction ('ltr' or 'rtl') for the current locale.
 *
 * Reads the active locale from TyndaleProvider context and checks it
 * against an internal list of RTL locales.
 *
 * ```tsx
 * import { useDirection } from 'tyndale-next';
 *
 * export default function RootLayout({ children }) {
 *   const dir = useDirection();
 *   return <html dir={dir}>{children}</html>;
 * }
 * ```
 */
export function useDirection(): 'ltr' | 'rtl' {
  const locale = useLocale();
  return getDirection(locale);
}
