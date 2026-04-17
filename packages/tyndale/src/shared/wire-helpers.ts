/**
 * Wire-format helpers shared across extraction pipelines (Babel JSX and Astro).
 *
 * Output of both serializers must match the runtime serializer in
 * `tyndale-react/src/wire-format.ts` byte-for-byte. The helpers live here so
 * the JSX and Astro paths share one canonical implementation.
 */

/** Variable components that become `{name}` placeholders in wire format. */
export const VARIABLE_COMPONENTS = new Set(['Var', 'Num', 'Currency', 'DateTime']);

/** Plural categories used in ICU MessageFormat, in canonical order. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/**
 * Normalize the text value of a JSX text node (Babel or Astro) into the wire
 * form. Trims interior whitespace while collapsing newlines to single spaces.
 */
export function normalizeJSXText(raw: string): string {
  const lines = raw.split('\n');
  const processed: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Trim leading whitespace from all lines except the first meaningful one
    if (i > 0) line = line.trimStart();
    // Trim trailing whitespace from all lines except the last meaningful one
    if (i < lines.length - 1) line = line.trimEnd();

    if (line) processed.push(line);
  }

  // Join with single space (JSX newline between text → space) and collapse multiple spaces
  return processed.join(' ').replace(/\s{2,}/g, ' ');
}

/**
 * Escape literal text content for the wire format.
 * `\` → `\\`, `{` → `\{`, `}` → `\}`.
 */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}
