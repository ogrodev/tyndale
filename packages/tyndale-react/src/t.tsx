import React, { useContext, useMemo, isValidElement, Children } from 'react';
import { TyndaleContext } from './context';
import { hash } from './hash';
import { serializeChildren, deserializeWireFormat } from './wire-format';
import { Plural } from './plural';

export interface TProps {
  children: React.ReactNode;
}

/**
 * Wraps translatable JSX content.
 * Serializes children to wire format, hashes, looks up translation,
 * deserializes back to React elements with variable substitution.
 * Falls back to children if no translation found.
 */
export function T({ children }: TProps): React.JSX.Element {
  const ctx = useContext(TyndaleContext);

  const result = useMemo(() => {
    try {
      return serializeChildren(children);
    } catch {
      return null;
    }
  }, [children]);

  if (!result || !ctx) {
    // No context or serialization failed — render source children
    return <>{children}</>;
  }

  const { wire, elementMap, variableMap } = result;
  const contentHash = hash(wire);
  const translated = ctx.translations[contentHash];

  if (!translated) {
    // No translation — render source children as-is
    return <>{children}</>;
  }

  // Extract plural count if a Plural component is in the children
  const pluralCount = extractPluralCount(children);

  try {
    const rendered = deserializeWireFormat(
      translated,
      elementMap,
      variableMap,
      ctx.locale,
      pluralCount,
    );
    return <>{rendered}</>;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[tyndale] Failed to deserialize translation for hash ${contentHash}:`, err);
    }
    return <>{children}</>;
  }
}

/**
 * Walks children to find a <Plural> component and extract its count prop.
 * If multiple Plural components exist, returns the first one's count.
 */
function extractPluralCount(children: React.ReactNode): number | undefined {
  let count: number | undefined;

  function walk(node: React.ReactNode): void {
    if (count !== undefined) return;
    if (!isValidElement(node)) return;

    if (node.type === Plural) {
      count = (node.props as any).count;
      return;
    }

    Children.forEach((node.props as any).children, walk);
  }

  Children.forEach(children, walk);
  return count;
}
