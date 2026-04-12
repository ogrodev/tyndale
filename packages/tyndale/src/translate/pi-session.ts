// packages/tyndale/src/translate/pi-session.ts

export interface TranslationInput {
  hash: string;
  source: string;
  context: string;
  type: string;
}

/**
 * Builds the translation prompt sent to Pi.
 * Includes source entries, target locale, and instructions for preserving
 * numbered tags and variable placeholders.
 */
export function buildTranslationPrompt(
  entries: TranslationInput[],
  localeCode: string,
  languageName: string,
): string {
  const entriesBlock = entries
    .map((e) => `  "${e.hash}": "${e.source}"`)
    .join(',\n');

  return `You are a professional translator. Translate the following text entries from the source language to ${languageName} (locale code: ${localeCode}).

CRITICAL RULES:
1. You MUST preserve all numbered tags exactly as they appear: <0>, </0>, <1>, </1>, etc. These are structural markers — translate only the text between them.
2. You MUST preserve all variable placeholders exactly as they appear: {name}, {count}, etc. Do NOT translate placeholder names.
3. Reordering of tags and placeholders is allowed when the target language grammar requires it.
4. Do NOT invent new tags or placeholders that don't exist in the source.
5. Every opening tag <N> must have a matching closing tag </N>.
6. Translate naturally and fluently — don't produce word-for-word translations.

SOURCE ENTRIES (hash → source text):
{
${entriesBlock}
}

Respond with a JSON object matching this schema:
{
  "translations": {
    "<hash>": "<translated text>",
    ...
  }
}

Translate ALL entries. Every hash from the source must appear in your response.`;
}

/**
 * Parses the structured result from Pi's submit_result.
 * Returns the translations record or null if malformed.
 */
export function parseTranslationResult(
  result: unknown,
): Record<string, string> | null {
  if (result === null || result === undefined || typeof result !== 'object') {
    return null;
  }
  const obj = result as Record<string, unknown>;
  if (!obj.translations || typeof obj.translations !== 'object' || Array.isArray(obj.translations)) {
    return null;
  }
  return obj.translations as Record<string, string>;
}

/**
 * Creates a Pi agent session configured for translation.
 * No tools — pure text generation with structured output via submit_result.
 */
export async function createTranslationSession() {
  const { createAgentSession, SessionManager, discoverAuthStorage } = await import('@mariozechner/pi-coding-agent');
  const authStorage = await discoverAuthStorage();
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    authStorage,
    toolNames: [],
    requireSubmitResultTool: true,
  });
  return session;
}
