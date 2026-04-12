import { useMemo } from 'react';
import { useTyndaleContext } from './context';

/**
 * Resolves dictionary entries for a given filename key.
 * Scans the manifest for entries where type === 'dictionary' and
 * dictFile matches the filenameKey. Maps dictKey → translated value.
 *
 * @param filenameKey - The dictionary file identifier (e.g., 'common', 'pages/home')
 * @returns Record<string, string> mapping dictionary keys to translated values
 */
export function useDictionary(filenameKey: string): Record<string, string> {
  const { manifest, translations } = useTyndaleContext();

  return useMemo(() => {
    if (!manifest) return {};

    const result: Record<string, string> = {};

    for (const [hash, entry] of Object.entries(manifest.entries)) {
      if (entry.type !== 'dictionary') continue;
      if (entry.dictFile !== filenameKey) continue;
      if (!entry.dictKey) continue;

      // Use translated value if available, otherwise use the dictKey as fallback
      result[entry.dictKey] = translations[hash] ?? entry.dictKey;
    }

    return result;
  }, [manifest, translations, filenameKey]);
}
