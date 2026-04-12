// packages/tyndale/src/translate/delta.ts

export interface ManifestEntry {
  type: 'jsx' | 'string' | 'dictionary';
  context: string;
  dictKey?: string;
  dictFile?: string;
}

export interface Manifest {
  version: number;
  defaultLocale: string;
  locales: string[];
  entries: Record<string, ManifestEntry>;
}

export type LocaleData = Record<string, string>;

export interface NewEntry {
  hash: string;
  source: string;
  context: string;
  type: string;
}

export interface Delta {
  /** Hashes in manifest but not in locale file (need translation). */
  newHashes: string[];
  /** Hashes in locale file but not in manifest (removed from source). */
  staleHashes: string[];
  /** Full entry data for new hashes, ready for batch prompting. */
  newEntries: NewEntry[];
}

export interface DeltaOptions {
  /** When true, treat all manifest entries as new (retranslate everything). */
  force?: boolean;
}

export function computeDelta(
  manifest: Manifest,
  defaultLocaleData: LocaleData,
  existingLocaleData: LocaleData,
  options: DeltaOptions = {},
): Delta {
  const manifestHashes = new Set(Object.keys(manifest.entries));
  const localeHashes = new Set(Object.keys(existingLocaleData));

  const newHashes: string[] = [];
  for (const hash of manifestHashes) {
    if (options.force || !localeHashes.has(hash)) {
      newHashes.push(hash);
    }
  }

  // In force mode, we retranslate everything — nothing is stale
  const staleHashes: string[] = [];
  if (!options.force) {
    for (const hash of localeHashes) {
      if (!manifestHashes.has(hash)) {
        staleHashes.push(hash);
      }
    }
  }

  const newEntries: NewEntry[] = newHashes.map((hash) => ({
    hash,
    source: defaultLocaleData[hash] ?? '',
    context: manifest.entries[hash].context,
    type: manifest.entries[hash].type,
  }));

  return { newHashes, staleHashes, newEntries };
}
