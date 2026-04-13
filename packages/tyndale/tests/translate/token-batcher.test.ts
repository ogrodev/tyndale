import { describe, it, expect } from 'bun:test';
import { splitByTokenBudget } from '../../src/translate/token-batcher';
import { countEntryTokens } from '../../src/translate/tokenizer';
import type { TranslationInput } from '../../src/translate/pi-session';

function entry(hash: string, source: string): TranslationInput {
  return { hash, source, context: 'a.tsx:T@1', type: 'jsx' };
}

describe('splitByTokenBudget', () => {
  it('returns empty array for empty input', () => {
    expect(splitByTokenBudget([], 100)).toEqual([]);
  });

  it('returns single batch when total tokens under budget', () => {
    const entries = [entry('h1', 'Hello'), entry('h2', 'World')];
    const totalTokens =
      countEntryTokens('h1', 'Hello') + countEntryTokens('h2', 'World');
    const batches = splitByTokenBudget(entries, totalTokens + 100);

    expect(batches).toHaveLength(1);
    expect(batches[0].entries).toEqual(entries);
    expect(batches[0].tokenCount).toBe(totalTokens);
  });

  it('splits into multiple batches when over budget', () => {
    const entries = [
      entry('h1', 'Hello'),
      entry('h2', 'World'),
      entry('h3', 'Foo'),
    ];
    // Use a very low budget to force splits
    const batches = splitByTokenBudget(entries, 20);

    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(batch.entries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('never splits mid-entry — each entry appears exactly once', () => {
    const entries = [
      entry('h1', 'Hello'),
      entry('h2', 'World'),
      entry('h3', 'Foo'),
      entry('h4', 'Bar'),
    ];
    const batches = splitByTokenBudget(entries, 20);

    const allEntries = batches.flatMap((b) => b.entries);
    expect(allEntries).toEqual(entries);
  });

  it('includes a single massive entry exceeding budget as sole batch entry', () => {
    const big = entry('h1', 'This is a very long sentence that will exceed any small token budget we set');
    const batches = splitByTokenBudget([big], 5);

    expect(batches).toHaveLength(1);
    expect(batches[0].entries).toEqual([big]);
    expect(batches[0].tokenCount).toBe(
      countEntryTokens(big.hash, big.source),
    );
  });

  it('each batch has accurate tokenCount', () => {
    const entries = [
      entry('h1', 'Hello'),
      entry('h2', 'World'),
      entry('h3', 'Another phrase'),
      entry('h4', 'Short'),
    ];
    const batches = splitByTokenBudget(entries, 20);

    for (const batch of batches) {
      const expected = batch.entries.reduce(
        (sum, e) => sum + countEntryTokens(e.hash, e.source),
        0,
      );
      expect(batch.tokenCount).toBe(expected);
    }
  });
});
