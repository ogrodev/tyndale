import type { TranslationInput } from './pi-session';
import { countEntryTokens } from './tokenizer';

export interface TokenBatch {
  entries: TranslationInput[];
  tokenCount: number;
}

export function splitByTokenBudget(
  entries: TranslationInput[],
  tokenBudget: number,
): TokenBatch[] {
  if (entries.length === 0) return [];

  const batches: TokenBatch[] = [];
  let currentEntries: TranslationInput[] = [];
  let currentTokens = 0;

  for (const entry of entries) {
    const entryTokens = countEntryTokens(entry.hash, entry.source);

    if (currentEntries.length > 0 && currentTokens + entryTokens > tokenBudget) {
      batches.push({ entries: currentEntries, tokenCount: currentTokens });
      currentEntries = [];
      currentTokens = 0;
    }

    currentEntries.push(entry);
    currentTokens += entryTokens;
  }

  if (currentEntries.length > 0) {
    batches.push({ entries: currentEntries, tokenCount: currentTokens });
  }

  return batches;
}
