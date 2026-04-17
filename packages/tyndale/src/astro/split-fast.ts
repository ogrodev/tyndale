/**
 * Pure regex/string-based frontmatter/template split for `.astro` files.
 * Does NOT run `@astrojs/compiler`. Used by docs validation where AST parsing
 * is overkill.
 *
 * Rules:
 * - File opens with `---\n` (optionally after BOM) and closes with `\n---` → `ok`
 * - File has no `---` fence anywhere → `no-frontmatter`
 * - File has content before the opening fence (not BOM) → `invalid-prelude`
 * - File opens with `---\n` but has no closing `---` → `unclosed-frontmatter`
 *
 * CRLF line endings are normalized for inspection; the returned `frontmatter`
 * and `body` are in LF form.
 */
export type AstroSplit =
  | { kind: 'ok'; frontmatter: string; body: string }
  | { kind: 'no-frontmatter'; body: string }
  | { kind: 'invalid-prelude' }
  | { kind: 'unclosed-frontmatter' };

export function splitAstroFast(code: string): AstroSplit {
  // Strip optional BOM.
  let source = code.startsWith('\uFEFF') ? code.slice(1) : code;
  // Normalize CRLF → LF so downstream regex can rely on `\n`.
  source = source.replace(/\r\n/g, '\n');

  if (source.startsWith('---\n') || source === '---' || source.startsWith('---\r')) {
    // Open fence on line 1. Look for closing `\n---` (followed by newline or EOF).
    const afterOpen = source.slice(4); // past "---\n"
    const closeMatch = afterOpen.match(/\n---(?:\n|$)/);
    if (!closeMatch || closeMatch.index === undefined) {
      return { kind: 'unclosed-frontmatter' };
    }
    const frontmatter = afterOpen.slice(0, closeMatch.index);
    const bodyStart = closeMatch.index + closeMatch[0].length;
    const body = afterOpen.slice(bodyStart);
    return { kind: 'ok', frontmatter, body };
  }

  // Not opening with `---\n`. Distinguish no-frontmatter from invalid-prelude.
  if (!/(^|\n)---(\n|$)/.test(source)) {
    return { kind: 'no-frontmatter', body: source };
  }

  // Contains a `---` fence somewhere other than line 1 → garbage before the opener.
  return { kind: 'invalid-prelude' };
}
