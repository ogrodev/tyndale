import type { TranslationSession } from './batch-translator';

/**
 * Mock translator for testing. Prefixes each source value with "[{locale}] ".
 * Preserves all numbered tags and variable placeholders.
 */
export function createMockTranslator(locale: string) {
  return async function mockTranslate(
    entries: Record<string, string>,
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [hash, source] of Object.entries(entries)) {
      result[hash] = `[${locale}] ${source}`;
    }
    return result;
  };
}

/**
 * Creates a mock TranslationSession that extracts hash→source pairs from
 * the prompt and returns them prefixed with "[{locale}] ".
 * Extracts the locale code from the prompt text.
 */
export function createMockSession(): TranslationSession {
  return {
    async sendPrompt(prompt: string): Promise<unknown> {
      // Extract locale code from prompt (e.g., "locale code: es")
      const localeMatch = prompt.match(/locale code:\s*(\w+)/);
      const locale = localeMatch?.[1] ?? 'mock';

      // Extract the JSON block from the prompt
      const jsonMatch = prompt.match(/SOURCE ENTRIES[^{]*\{([\s\S]*?)\}\s*\n/);
      if (!jsonMatch) {
        // Retry prompt — extract from ERRORS TO FIX block
        const retryMatch = prompt.match(/ERRORS TO FIX:\s*\{([\s\S]*?)\}\s*\n/);
        if (!retryMatch) return { translations: {} };
        try {
          const parsed = JSON.parse(`{${retryMatch[1]}}`);
          const translations: Record<string, string> = {};
          for (const [hash, entry] of Object.entries(parsed)) {
            const source = (entry as any).source ?? '';
            translations[hash] = `[${locale}] ${source}`;
          }
          return { translations };
        } catch {
          return { translations: {} };
        }
      }

      try {
        const entries = JSON.parse(`{${jsonMatch[1]}}`);
        const translations: Record<string, string> = {};
        for (const [hash, source] of Object.entries(entries)) {
          translations[hash] = `[${locale}] ${source}`;
        }
        return { translations };
      } catch {
        return { translations: {} };
      }
    },
  };
}
