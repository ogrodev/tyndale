import React, { useContext } from 'react';
import { TyndaleContext } from './context';
import { hash } from './hash';

interface MsgResolverProps {
  source: string;
}

/**
 * Internal component that resolves a translatable string using context.
 */
function MsgResolver({ source }: MsgResolverProps): React.JSX.Element {
  const ctx = useContext(TyndaleContext);
  if (!ctx) return <>{source}</>;

  const h = hash(source);
  const translated = ctx.translations[h] ?? source;
  return <>{translated}</>;
}

/**
 * Marker function for translatable strings defined outside component render.
 * Returns a React element that resolves to the translated string when
 * rendered inside a TyndaleProvider subtree.
 *
 * Usage:
 * ```tsx
 * const NAV = [{ label: msg('Home'), href: '/' }];
 * // Later, in JSX: <a>{item.label}</a>
 * ```
 *
 * The CLI extractor recognizes msg('literal') calls and extracts the argument.
 */
export function msg(source: string): React.ReactElement {
  return <MsgResolver source={source} />;
}
