import { useContext } from 'react';
import { TyndaleContext } from './context';
import type { NumProps } from './types';

/**
 * Locale-aware number formatter.
 * Standalone: renders formatted number. Inside <T>: serialized as {name}.
 */
export function Num({ value, options }: NumProps): React.JSX.Element {
  const ctx = useContext(TyndaleContext);
  const locale = ctx?.locale ?? 'en';
  const formatted = new Intl.NumberFormat(locale, options).format(value);
  return <>{formatted}</>;
}
