import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Recursively walk a directory collecting files matching the given extensions,
 * skipping top-level directories whose names match a known locale.
 */
export function walkDir(dir: string, extensions: string[], locales: string[]): string[] {
  const results: string[] = [];
  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const relDir = relative(dir, fullPath);
        // Skip top-level locale directories
        if (!relDir.includes('/') && locales.includes(entry)) continue;
        walk(fullPath);
      } else if (extensions.some(ext => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  walk(dir);
  return results;
}
