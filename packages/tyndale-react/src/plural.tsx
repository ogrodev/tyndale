import { useContext } from 'react';
import { TyndaleContext } from './context';
import type { PluralProps, PluralCategory } from './types';

/**
 * Interpolates {count} in a plural branch string.
 */
export function interpolatePluralBranch(
  text: string,
  count: number,
): string {
  return text.replace(/\{count\}/g, String(count));
}

/**
 * Selects the appropriate plural branch for a given count and locale.
 */
export function selectPluralBranch(
  props: PluralProps,
  locale: string,
): string {
  const { count, zero, one, two, few, many, other } = props;
  const branches: Record<PluralCategory, string | undefined> = {
    zero,
    one,
    two,
    few,
    many,
    other,
  };

  // Explicit zero check: if count is 0 and zero branch provided, use it
  // regardless of what Intl.PluralRules says (English returns 'other' for 0)
  if (count === 0 && zero !== undefined) {
    return zero;
  }

  const rules = new Intl.PluralRules(locale);
  const category = rules.select(count) as PluralCategory;
  return branches[category] ?? other;
}

/**
 * Pluralization component using CLDR plural rules.
 * Standalone: selects branch and interpolates {count}.
 * Inside <T>: serialized to ICU format.
 */
export function Plural(props: PluralProps): React.JSX.Element {
  const ctx = useContext(TyndaleContext);
  const locale = ctx?.locale ?? 'en';
  const branch = selectPluralBranch(props, locale);
  const text = interpolatePluralBranch(branch, props.count);
  return <>{text}</>;
}
