// packages/tyndale/tests/translate/batch-translator.test.ts
import { describe, it, expect } from 'bun:test';
import {
  splitIntoBatches,
  translateBatch,
  type TranslationInput,
  type TranslationSession,
  type BatchResult,
} from '../../src/translate/batch-translator';

describe('splitIntoBatches', () => {
  it('returns single batch when entries fit', () => {
    const entries: TranslationInput[] = [
      { hash: 'a', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
      { hash: 'b', source: 'World', context: 'b.tsx:T@2', type: 'jsx' },
    ];
    const batches = splitIntoBatches(entries, 50);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it('splits entries into multiple batches', () => {
    const entries: TranslationInput[] = Array.from({ length: 7 }, (_, i) => ({
      hash: `h${i}`,
      source: `Text ${i}`,
      context: `file.tsx:T@${i}`,
      type: 'string' as const,
    }));
    const batches = splitIntoBatches(entries, 3);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(3);
    expect(batches[1]).toHaveLength(3);
    expect(batches[2]).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    const batches = splitIntoBatches([], 50);
    expect(batches).toEqual([]);
  });
});

describe('translateBatch', () => {
  it('returns translations from a successful session', async () => {
    const entries: TranslationInput[] = [
      { hash: 'abc', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
      { hash: 'def', source: 'World', context: 'b.tsx:T@2', type: 'jsx' },
    ];

    const mockSession: TranslationSession = {
      async sendPrompt(_prompt: string) {
        return {
          translations: {
            abc: 'Hola',
            def: 'Mundo',
          },
        };
      },
    };

    const result = await translateBatch(mockSession, entries, 'es', 'Spanish');
    expect(result.translations).toEqual({ abc: 'Hola', def: 'Mundo' });
    expect(result.failedHashes).toEqual([]);
  });

  it('reports failed hashes when session returns null', async () => {
    const entries: TranslationInput[] = [
      { hash: 'abc', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
    ];

    const mockSession: TranslationSession = {
      async sendPrompt(_prompt: string) {
        return null;
      },
    };

    const result = await translateBatch(mockSession, entries, 'es', 'Spanish');
    expect(result.translations).toEqual({});
    expect(result.failedHashes).toEqual(['abc']);
  });

  it('validates translations and excludes invalid ones', async () => {
    const entries: TranslationInput[] = [
      { hash: 'h1', source: '<0>Hello</0>', context: 'a.tsx:T@1', type: 'jsx' },
      { hash: 'h2', source: 'Plain text', context: 'b.tsx:T@2', type: 'string' },
    ];

    const mockSession: TranslationSession = {
      sendPromptCount: 0,
      async sendPrompt(_prompt: string) {
        this.sendPromptCount++;
        if (this.sendPromptCount === 1) {
          // First call: h1 has missing tag, h2 is fine
          return {
            translations: {
              h1: 'Hola',          // Missing <0></0> tags — invalid
              h2: 'Texto plano',   // Valid
            },
          };
        }
        // Retry for h1: still broken
        return {
          translations: {
            h1: 'Hola sin tags',  // Still missing tags
          },
        };
      },
    } as any;

    const result = await translateBatch(mockSession, entries, 'es', 'Spanish');
    expect(result.translations).toEqual({ h2: 'Texto plano' });
    expect(result.failedHashes).toEqual(['h1']);
  });
});
