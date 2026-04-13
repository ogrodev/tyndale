/**
 * String marker for translatable strings in non-React contexts (Astro, Node, etc.).
 * Returns the source string unchanged — the CLI extractor recognizes msgString()
 * calls and extracts the argument.
 *
 * Usage:
 * ```ts
 * import { msgString } from 'tyndale-react';
 * const strings = { greeting: msgString('Hello') };
 * ```
 */
export function msgString(source: string): string {
  return source;
}
