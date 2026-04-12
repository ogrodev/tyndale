// packages/tyndale/src/translate/locale-writer.ts
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname } from 'path';

export type LocaleData = Record<string, string>;

/**
 * Reads a locale JSON file. Returns empty object if file doesn't exist.
 */
export async function readLocaleFile(filePath: string): Promise<LocaleData> {
  if (!existsSync(filePath)) return {};
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as LocaleData;
}

/**
 * Merges new translations into existing locale data, removes stale entries,
 * and writes the result to disk.
 *
 * Keys are sorted for deterministic output (stable diffs).
 */
export async function writeLocaleFile(
  filePath: string,
  existing: LocaleData,
  newTranslations: LocaleData,
  staleHashes: string[],
): Promise<void> {
  const staleSet = new Set(staleHashes);

  // Start with existing, remove stale, merge new
  const merged: LocaleData = {};

  for (const [hash, value] of Object.entries(existing)) {
    if (!staleSet.has(hash)) {
      merged[hash] = value;
    }
  }

  for (const [hash, value] of Object.entries(newTranslations)) {
    merged[hash] = value;
  }

  // Sort keys for deterministic output
  const sorted: LocaleData = {};
  for (const key of Object.keys(merged).sort()) {
    sorted[key] = merged[key];
  }

  // Ensure directory exists
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
}
