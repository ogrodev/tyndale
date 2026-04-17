/**
 * Static portability checks shared by the per-package `portability.test.ts` suites.
 *
 * Guards against the class of bugs that dev-harness testing hides:
 *   - Bun-only APIs in shipped code (`from 'bun'`, `Bun.*`, `import.meta.main`)
 *   - Extensionless ESM imports that Node's strict resolver rejects
 *   - Missing shebang on published bin scripts
 *
 * These are cheap, file-level scans. Runtime behaviour is covered by Layer 2 (E2E).
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const DIST_EXTENSIONS = new Set(['.js', '.mjs']);
const EXPLICIT_IMPORT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.json', '.css', '.svg', '.png',
  // `.ts`/`.tsx` would be wrong in emitted JS, but in source TypeScript with
  // `allowImportingTsExtensions` they are accepted. We treat them as explicit.
  '.ts', '.tsx',
]);

export interface CheckOptions {
  /** Absolute path to the package root (the one containing `src/` and `package.json`). */
  packageRoot: string;
  /** If provided, assert the relative path inside the package starts with this shebang. */
  binFile?: string;
  /** Shebang the bin file must start with. Default: `#!/usr/bin/env node`. */
  shebang?: string;
}

export interface PortabilityIssue {
  category:
    | 'forbidden-bun-import'
    | 'forbidden-bun-api'
    | 'forbidden-import-meta-main'
    | 'missing-extension'
    | 'unresolved-import'
    | 'missing-shebang'
    | 'missing-bin';
  file: string;
  detail: string;
}

/** Walk a directory and yield files matching the given extensions. */
async function* walk(dir: string, extensions: Set<string>): AsyncGenerator<string> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      yield* walk(full, extensions);
    } else if (s.isFile()) {
      const dot = name.lastIndexOf('.');
      if (dot >= 0 && extensions.has(name.slice(dot))) yield full;
    }
  }
}

// Regexes are line-agnostic: import/export/dynamic-import forms.
const STATIC_IMPORT = /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function extractSpecifiers(source: string): string[] {
  const specs: string[] = [];
  for (const m of source.matchAll(STATIC_IMPORT)) specs.push(m[1]);
  for (const m of source.matchAll(DYNAMIC_IMPORT)) specs.push(m[1]);
  return specs;
}

function endsWithExplicitExtension(spec: string): boolean {
  const qIdx = spec.indexOf('?');
  const cleaned = qIdx >= 0 ? spec.slice(0, qIdx) : spec;
  const lastDot = cleaned.lastIndexOf('.');
  const lastSlash = cleaned.lastIndexOf('/');
  if (lastDot < 0 || lastDot < lastSlash) return false;
  return EXPLICIT_IMPORT_EXTENSIONS.has(cleaned.slice(lastDot));
}

/**
 * Core check. Returns a list of issues — empty means portability is intact.
 * Tests should call this and assert `issues.length === 0`, printing the
 * formatted list on failure.
 */
export async function checkPortability(opts: CheckOptions): Promise<PortabilityIssue[]> {
  const issues: PortabilityIssue[] = [];
  const srcDir = join(opts.packageRoot, 'src');
  const distDir = join(opts.packageRoot, 'dist');

  // ── Source scan ────────────────────────────────────────────────────
  for await (const file of walk(srcDir, SOURCE_EXTENSIONS)) {
    const rel = relative(opts.packageRoot, file);
    const contents = await readFile(file, 'utf-8');

    if (/\bfrom\s+['"]bun['"]/.test(contents)) {
      issues.push({
        category: 'forbidden-bun-import',
        file: rel,
        detail: `imports from 'bun' — use Node stdlib or tinyglobby`,
      });
    }
    if (/\bBun\s*\./.test(contents)) {
      issues.push({
        category: 'forbidden-bun-api',
        file: rel,
        detail: `accesses Bun.* global — use Node stdlib equivalents`,
      });
    }
    if (/\bimport\.meta\.main\b/.test(contents)) {
      issues.push({
        category: 'forbidden-import-meta-main',
        file: rel,
        detail: `uses import.meta.main — Bun-only; use fileURLToPath(import.meta.url) === process.argv[1]`,
      });
    }

    for (const spec of extractSpecifiers(contents)) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
      if (endsWithExplicitExtension(spec)) continue;

      // Resolve: does `spec` point to a file (append .ts/.tsx) or a dir (/index.ts)?
      const fileDir = file.slice(0, file.lastIndexOf('/'));
      const abs = join(fileDir, spec);
      const asFile = existsSync(`${abs}.ts`) || existsSync(`${abs}.tsx`);
      const asIndex =
        existsSync(join(abs, 'index.ts')) || existsSync(join(abs, 'index.tsx'));
      issues.push({
        category: asFile || asIndex ? 'missing-extension' : 'unresolved-import',
        file: rel,
        detail:
          asFile
            ? `relative import "${spec}" missing explicit extension — append ".js"`
            : asIndex
              ? `relative import "${spec}" resolves to a directory — append "/index.js"`
              : `relative import "${spec}" could not be resolved`,
      });
    }
  }

  // ── Dist scan (only when build output exists) ──────────────────────
  if (existsSync(distDir)) {
    for await (const file of walk(distDir, DIST_EXTENSIONS)) {
      const rel = relative(opts.packageRoot, file);
      const contents = await readFile(file, 'utf-8');
      for (const spec of extractSpecifiers(contents)) {
        if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
        if (endsWithExplicitExtension(spec)) continue;
        issues.push({
          category: 'missing-extension',
          file: rel,
          detail: `emitted import "${spec}" has no extension — Node ESM will not resolve it`,
        });
      }
    }
  }

  // ── Bin shebang check ──────────────────────────────────────────────
  if (opts.binFile) {
    const binPath = join(opts.packageRoot, opts.binFile);
    if (!existsSync(binPath)) {
      issues.push({
        category: 'missing-bin',
        file: opts.binFile,
        detail: `bin file not found at ${opts.binFile} (did you run \`bun run build\`?)`,
      });
    } else {
      const expected = opts.shebang ?? '#!/usr/bin/env node';
      const firstLine = (await readFile(binPath, 'utf-8')).split('\n', 1)[0];
      if (firstLine !== expected) {
        issues.push({
          category: 'missing-shebang',
          file: opts.binFile,
          detail: `first line must be "${expected}", got "${firstLine}"`,
        });
      }
    }
  }

  return issues;
}

/** Format issues for a readable test failure message. */
export function formatIssues(issues: PortabilityIssue[]): string {
  if (issues.length === 0) return '(none)';
  const lines = issues.map((i) => `  [${i.category}] ${i.file}: ${i.detail}`);
  return `\n${lines.join('\n')}\n`;
}
