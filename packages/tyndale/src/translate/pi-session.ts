import type { TranslationSession } from './batch-translator';

export interface TranslationInput {
  hash: string;
  source: string;
  context: string;
  type: string;
}

export function buildTranslationPrompt(
  entries: TranslationInput[],
  localeCode: string,
  languageName: string,
  brief?: string,
): string {
  const entriesBlock = entries
    .map((e) => `  "${e.hash}": "${e.source}"`)
    .join(',\n');

  const briefSection = brief
    ? `\nTRANSLATION BRIEF:\n${brief}\n`
    : '';

  return `You are a professional translator. Translate the following text entries from the source language to ${languageName} (locale code: ${localeCode}).

CRITICAL RULES:
1. You MUST preserve all numbered tags exactly as they appear: <0>, </0>, <1>, </1>, etc. These are structural markers — translate only the text between them.
2. You MUST preserve all variable placeholders exactly as they appear: {name}, {count}, etc. Do NOT translate placeholder names.
3. Reordering of tags and placeholders is allowed when the target language grammar requires it.
4. Do NOT invent new tags or placeholders that don't exist in the source.
5. Every opening tag <N> must have a matching closing tag </N>.
6. Translate naturally and fluently — don't produce word-for-word translations.
${briefSection}
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

// ── SDK initialization (expensive — do once) ────────────────

interface PiSDK {
  createAgentSession: any;
  SessionManager: any;
  authStorage: any;
  modelRegistry: any;
}

let cachedSDK: PiSDK | null = null;

/**
 * Initialize the Pi SDK once. Subsequent calls return the cached instance.
 * This is the expensive part: dynamic import + auth + model registry.
 */
async function getSDK(): Promise<PiSDK> {
  if (cachedSDK) return cachedSDK;

  const { AuthStorage, ModelRegistry, createAgentSession, SessionManager } =
    await import('@mariozechner/pi-coding-agent');

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  modelRegistry.refresh();

  cachedSDK = { createAgentSession, SessionManager, authStorage, modelRegistry };
  return cachedSDK;
}

// ── Response extractors ─────────────────────────────────────

function extractJsonResponse(textParts: string): unknown {
  try {
    const jsonMatch = textParts.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch {
    return null;
  }
}

function extractTextResponse(textParts: string): unknown {
  return textParts || null;
}

// ── Session factory ─────────────────────────────────────────

type ResponseMode = 'json' | 'text';

async function createSession(mode: ResponseMode): Promise<TranslationSession> {
  const sdk = await getSDK();

  const { session } = await sdk.createAgentSession({
    sessionManager: sdk.SessionManager.inMemory(),
    authStorage: sdk.authStorage,
    modelRegistry: sdk.modelRegistry,
    tools: [],
  });

  const extract = mode === 'json' ? extractJsonResponse : extractTextResponse;

  return {
    async sendPrompt(prompt: string): Promise<unknown> {
      return new Promise<unknown>((resolve, reject) => {
        const unsubscribe = session.subscribe((event: any) => {
          if (event.type === 'agent_end') {
            unsubscribe();
            const messages: any[] = event.messages ?? [];
            const assistantMsg = [...messages].reverse().find(
              (m: any) => m.role === 'assistant'
            );
            if (!assistantMsg) {
              resolve(null);
              return;
            }
            const textParts = (assistantMsg.content ?? [])
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');
            resolve(extract(textParts));
          } else if (event.type === 'error') {
            unsubscribe();
            reject(new Error(event.error?.message ?? 'Agent session error'));
          }
        });
        session.prompt(prompt).catch(reject);
      });
    },
  };
}

/** Creates a session that parses JSON from the AI response. */
export async function createTranslationSession(): Promise<TranslationSession> {
  return createSession('json');
}

/** Creates a session that returns raw text (for doc translation). */
export async function createTextSession(): Promise<TranslationSession> {
  return createSession('text');
}
