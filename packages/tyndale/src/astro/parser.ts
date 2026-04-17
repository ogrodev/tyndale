/**
 * Wrapper around `@astrojs/compiler`'s WASM parser.
 *
 * The compiler performs a one-time WASM instantiation per process; the first
 * call to `parse` may be slow (tens of milliseconds), subsequent calls are
 * effectively free. We memoize the module import promise so concurrent calls
 * share one init.
 */
import type { File } from '@babel/types';
import type {
  FrontmatterNode,
  Node,
  ParseResult,
  RootNode,
  DiagnosticMessage,
} from '@astrojs/compiler/types';
import { parseSource } from '../extract/ast-parser.js';

export interface AstroFile {
  /** Source string of the frontmatter with its fence lines excluded. Empty string if none. */
  frontmatter: string;
  /** 1-indexed line of the first frontmatter line (i.e. the line after the opening `---`). Equals `templateStartLine` when no frontmatter. */
  frontmatterStartLine: number;
  /** 1-indexed line of the closing `---` fence. Equals `frontmatterStartLine - 1` when no frontmatter. */
  frontmatterEndLine: number;
  /** Root node of the template AST. Frontmatter children are stripped so downstream walkers only see template nodes. */
  templateRoot: RootNode;
  /** 1-indexed line where the template begins (the line after the closing `---`). When no frontmatter, defaults to 1. */
  templateStartLine: number;
}

// Cached module import. Resolves to the compiler namespace once WASM is initialized.
let compilerPromise: Promise<typeof import('@astrojs/compiler')> | null = null;

function loadCompiler(): Promise<typeof import('@astrojs/compiler')> {
  if (!compilerPromise) {
    compilerPromise = import('@astrojs/compiler').catch((err) => {
      // Nullify so a retry can recover from a transient failure (e.g. stale FS cache).
      compilerPromise = null;
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to initialize Astro compiler: ${message}. Reinstall dependencies with 'bun install'.`,
      );
    });
  }
  return compilerPromise;
}

/** Parse an `.astro` source into a structured `AstroFile`. */
export async function parseAstro(code: string, filename: string): Promise<AstroFile> {
  const compiler = await loadCompiler();
  if (typeof compiler.parse !== 'function') {
    throw new Error(
      `Astro compiler API mismatch — expected @astrojs/compiler exporting parse(); got ${typeof compiler.parse}.`,
    );
  }

  let result: ParseResult;
  try {
    result = await compiler.parse(code, { position: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Astro parse error in ${filename}: ${message}`);
  }

  const errorDiags = (result.diagnostics ?? []).filter(isFatalDiagnostic);
  if (errorDiags.length > 0) {
    throw new Error(`Astro parse error in ${filename}: ${errorDiags.map((d) => d.text).join('; ')}`);
  }

  const root = result.ast;
  const children = (root.children ?? []) as Node[];
  const frontmatterNode = children.find(
    (child): child is FrontmatterNode => child.type === 'frontmatter',
  );

  let frontmatter = '';
  let frontmatterStartLine = 1;
  let frontmatterEndLine = 0;
  let templateStartLine = 1;

  if (frontmatterNode) {
    // @astrojs/compiler returns a `value` that includes the newline immediately
    // after the opening `---` fence. Strip at most one leading `\n` so the
    // value's line 1 aligns with `frontmatterStartLine` in the source.
    let rawValue = frontmatterNode.value ?? '';
    if (rawValue.startsWith('\n')) rawValue = rawValue.slice(1);
    frontmatter = rawValue;
    const fenceStart = frontmatterNode.position?.start.line ?? 1;
    const fenceEnd = frontmatterNode.position?.end?.line ?? fenceStart;
    // Opening fence is at fenceStart; first line of code is fenceStart + 1.
    frontmatterStartLine = fenceStart + 1;
    // Closing fence line.
    frontmatterEndLine = fenceEnd;
    templateStartLine = fenceEnd + 1;
  } else {
    frontmatterStartLine = 1;
    frontmatterEndLine = 0;
    templateStartLine = 1;
  }

  // Strip frontmatter from the template root so downstream walkers never see it.
  const templateRoot: RootNode = {
    ...root,
    children: children.filter((child) => child.type !== 'frontmatter'),
  };

  return {
    frontmatter,
    frontmatterStartLine,
    frontmatterEndLine,
    templateRoot,
    templateStartLine,
  };
}

/**
 * Parse a frontmatter source block as TypeScript. Offsets `loc.start.line` so
 * line numbers in the returned Babel AST reference the original `.astro`
 * source, not the isolated frontmatter buffer.
 *
 * `frontmatterStartLine` is the 1-indexed line of the first frontmatter code
 * line (i.e. the line immediately after the opening `---`).
 */
export function parseFrontmatterAsTs(
  source: string,
  filename: string,
  frontmatterStartLine: number,
): File {
  const padding = Math.max(0, frontmatterStartLine - 1);
  const padded = '\n'.repeat(padding) + source;
  return parseSource(padded, filename);
}

function isFatalDiagnostic(d: DiagnosticMessage): boolean {
  // DiagnosticSeverity.Error === 1. Import enum would add coupling; compare numeric value.
  return d.severity === 1;
}
