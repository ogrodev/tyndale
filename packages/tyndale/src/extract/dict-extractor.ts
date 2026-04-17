import { join, relative } from 'node:path';
import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { computeHash } from 'tyndale-react'
import type { ExtractedEntry } from './t-extractor.js';

export interface DictExtractOptions {
  include: string[];
  rootDir: string;
}

/**
 * Extracts translatable entries from JSON dictionary files.
 *
 * Each key-value pair becomes an entry with:
 * - hash: sha256("dict:{filenameKey}:{dictKey}:{value}")
 * - type: "dictionary"
 * - dictFile: filename key (relative path without extension)
 * - dictKey: the JSON key
 */
export async function extractDictionaries(options: DictExtractOptions): Promise<ExtractedEntry[]> {
  const { include, rootDir } = options;
  const entries: ExtractedEntry[] = [];

  for (const pattern of include) {
    // Determine the glob root — the static prefix of the pattern
    const globRoot = getGlobRoot(pattern);

    try {
      const matches = await glob(pattern, { cwd: rootDir, absolute: false });
      for (const match of matches) {
        const absPath = join(rootDir, match);
        const content = await readFile(absPath, 'utf-8');

        let data: Record<string, string>;
        try {
          data = JSON.parse(content);
        } catch {
          continue; // Skip malformed JSON
        }

        const filenameKey = deriveFilenameKey(match, globRoot);

        for (const [key, value] of Object.entries(data)) {
          if (typeof value !== 'string') continue;

          const hashInput = `dict:${filenameKey}:${key}:${value}`;
          const hash = computeHash(hashInput);

          entries.push({
            hash,
            wireFormat: value,
            type: 'dictionary',
            context: `dict:${filenameKey}:${key}`,
            dictKey: key,
            dictFile: filenameKey,
          });
        }
      }
    } catch {
      // Pattern matches nothing — skip
    }
  }

  return entries;
}

/**
 * Gets the static prefix of a glob pattern (everything before the first
 * wildcard character).
 *
 * Examples:
 * - "src/dictionaries/*.json" → "src/dictionaries"
 * - "src/dictionaries/**\/*.json" → "src/dictionaries"
 */
function getGlobRoot(pattern: string): string {
  const parts = pattern.split('/');
  const staticParts: string[] = [];

  for (const part of parts) {
    if (part.includes('*') || part.includes('?') || part.includes('{')) break;
    staticParts.push(part);
  }

  return staticParts.join('/');
}

/**
 * Derives the filename key from a file path relative to the glob root.
 *
 * Examples:
 * - match="src/dictionaries/common.json", root="src/dictionaries" → "common"
 * - match="src/dictionaries/pages/home.json", root="src/dictionaries" → "pages/home"
 */
function deriveFilenameKey(matchPath: string, globRoot: string): string {
  // matchPath is relative to rootDir, globRoot is the static part of the pattern
  let rel = matchPath;

  if (rel.startsWith(globRoot + '/')) {
    rel = rel.slice(globRoot.length + 1);
  } else if (rel.startsWith(globRoot)) {
    rel = rel.slice(globRoot.length);
    if (rel.startsWith('/')) rel = rel.slice(1);
  }

  // Remove extension
  const lastDot = rel.lastIndexOf('.');
  if (lastDot > 0) {
    rel = rel.slice(0, lastDot);
  }

  return rel;
}
