/**
 * Escapes literal characters in user text so they don't conflict with wire format syntax.
 *
 * Escaping order matters — backslash first (to avoid double-escaping), then braces, then entities.
 * - `\` → `\\`
 * - `{` → `\{`
 * - `}` → `\}`
 * - `&` → `&amp;`   (before < and > to avoid escaping the `&` in `&lt;`/`&gt;`)
 * - `<` → `&lt;`
 * - `>` → `&gt;`
 */
export function escapeWireFormat(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Reverses wire format escaping to recover the original literal text.
 *
 * Decoding order is the reverse of encoding:
 * 1. Entity decoding: `&lt;` → `<`, `&gt;` → `>`, `&amp;` → `&`
 * 2. Backslash unescaping: `\{` → `{`, `\}` → `}`, `\\` → `\`
 */
export function unescapeWireFormat(text: string): string {
  // Phase 1: entity decoding
  let result = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  // Phase 2: backslash unescaping
  // Process left-to-right so `\\{` → `\{` (escaped backslash + literal brace opener)
  // is handled correctly. Use a single pass regex that matches any backslash sequence.
  result = result.replace(/\\(.)/g, '$1');

  return result;
}
