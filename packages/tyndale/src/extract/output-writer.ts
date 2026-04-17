import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import type { ExtractedEntry } from './t-extractor.js';
import type { Manifest, ManifestEntry } from 'tyndale-react'

export interface WriteOptions {
  entries: ExtractedEntry[];
  outputDir: string;
  defaultLocale: string;
  locales: string[];
}

/**
 * Writes `manifest.json` and `{defaultLocale}.json` to the output directory.
 * Deduplicates entries by hash — first occurrence's context is kept.
 */
export async function writeExtractionOutput(options: WriteOptions): Promise<void> {
  const { entries, outputDir, defaultLocale, locales } = options;

  mkdirSync(outputDir, { recursive: true });

  const manifestEntries: Record<string, ManifestEntry> = {};
  const localeData: Record<string, string> = {};

  for (const entry of entries) {
    // Deduplicate by hash — first context wins
    if (manifestEntries[entry.hash]) continue;

    const manifestEntry: ManifestEntry = {
      type: entry.type,
      context: entry.context,
    };

    if (entry.type === 'dictionary') {
      manifestEntry.dictKey = entry.dictKey;
      manifestEntry.dictFile = entry.dictFile;
    }

    manifestEntries[entry.hash] = manifestEntry;
    localeData[entry.hash] = entry.wireFormat;
  }

  const manifest: Manifest = {
    version: 1,
    defaultLocale,
    locales,
    entries: manifestEntries,
  };

  writeFileSync(
    join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );

  writeFileSync(
    join(outputDir, `${defaultLocale}.json`),
    JSON.stringify(localeData, null, 2) + '\n',
  );
}
