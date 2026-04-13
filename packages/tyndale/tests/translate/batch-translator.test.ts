// packages/tyndale/tests/translate/batch-translator.test.ts
import { describe, it, expect } from 'bun:test';
import {
  translateBatch,
  type TranslationInput,
  type TranslationSession,
} from '../../src/translate/batch-translator';

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

  it('retries invalid translations and reports persistent failures', async () => {
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

  it('passes brief to prompt when provided', async () => {
    const entries: TranslationInput[] = [
      { hash: 'abc', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
    ];

    let capturedPrompt = '';
    const mockSession: TranslationSession = {
      async sendPrompt(prompt: string) {
        capturedPrompt = prompt;
        return { translations: { abc: 'Hola' } };
      },
    };

    const brief = '## Tone\nUse informal register.';
    await translateBatch(mockSession, entries, 'es', 'Spanish', brief);
    expect(capturedPrompt).toContain('TRANSLATION BRIEF:');
    expect(capturedPrompt).toContain('Use informal register.');
  });

  it('omits brief section when brief is not provided', async () => {
    const entries: TranslationInput[] = [
      { hash: 'abc', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
    ];

    let capturedPrompt = '';
    const mockSession: TranslationSession = {
      async sendPrompt(prompt: string) {
        capturedPrompt = prompt;
        return { translations: { abc: 'Hola' } };
      },
    };

    await translateBatch(mockSession, entries, 'es', 'Spanish');
    expect(capturedPrompt).not.toContain('TRANSLATION BRIEF:');
  });
});
