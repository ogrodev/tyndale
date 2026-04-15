import type { TranslationSession } from './batch-translator';

export interface TranslationInput {
  hash: string;
  source: string;
  context: string;
  type: string;
}

export interface TranslationSessionToolEvent {
  toolCallId: string;
  toolName: string;
  args: unknown;
  summary?: string;
  isError?: boolean;
}

export type TranslationSessionActivityEvent =
  | { type: 'prompt_start'; mode: 'json' | 'text' }
  | { type: 'turn_start' }
  | { type: 'text_delta'; delta: string; text: string }
  | ({ type: 'tool_start' } & TranslationSessionToolEvent)
  | ({ type: 'tool_update' } & TranslationSessionToolEvent)
  | ({ type: 'tool_end' } & TranslationSessionToolEvent)
  | { type: 'complete'; mode: 'json' | 'text'; text: string; response: unknown }
  | { type: 'error'; message: string };

export type TranslationSessionActivityListener = (
  event: TranslationSessionActivityEvent,
 ) => void;

export interface CreateTranslationSessionOptions {
  onActivity?: TranslationSessionActivityListener;
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

type ResponseMode = 'json' | 'text';

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

function extractMessageText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (item): item is { type: 'text'; text: string } =>
        item !== null
        && typeof item === 'object'
        && (item as { type?: unknown }).type === 'text'
        && typeof (item as { text?: unknown }).text === 'string',
    )
    .map((item) => item.text)
    .join('');
}

function findLastAssistantText(messages: unknown): string {
  if (!Array.isArray(messages)) return '';

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && typeof message === 'object' && (message as { role?: unknown }).role === 'assistant') {
      return extractMessageText((message as { content?: unknown }).content);
    }
  }

  return '';
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim().length > 0) return error;
  return 'Agent session error';
}

function collapseSummary(text: string, limit = 96): string | undefined {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return undefined;
  return collapsed.length > limit ? `${collapsed.slice(0, limit - 1)}…` : collapsed;
}

function summarizeScalar(value: unknown): string | undefined {
  if (typeof value === 'string') return collapseSummary(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function summarizeToolPayload(payload: unknown): string | undefined {
  if (payload == null) return undefined;
  if (typeof payload !== 'object') return summarizeScalar(payload);

  const contentSummary = extractMessageText((payload as { content?: unknown }).content);
  if (contentSummary) {
    return collapseSummary(contentSummary);
  }

  const details = (payload as { details?: unknown }).details;
  return summarizeScalar(details);
}

function emitActivity(
  listener: TranslationSessionActivityListener | undefined,
  event: TranslationSessionActivityEvent,
): void {
  listener?.(event);
}

// ── Session factory ─────────────────────────────────────────

async function createSession(
  mode: ResponseMode,
  options?: CreateTranslationSessionOptions,
): Promise<TranslationSession> {
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
        let settled = false;
        let streamedText = '';

        const finish = (outcome: 'resolve' | 'reject', value: unknown) => {
          if (settled) return;
          settled = true;
          unsubscribe();
          if (outcome === 'resolve') {
            resolve(value);
            return;
          }
          reject(value);
        };

        emitActivity(options?.onActivity, { type: 'prompt_start', mode });

        const unsubscribe = session.subscribe((event: any) => {
          if (event.type === 'turn_start') {
            emitActivity(options?.onActivity, { type: 'turn_start' });
            return;
          }

          if (event.type === 'message_update') {
            const assistantMessageEvent = event.assistantMessageEvent;
            if (assistantMessageEvent?.type === 'text_delta' && typeof assistantMessageEvent.delta === 'string') {
              streamedText += assistantMessageEvent.delta;
              emitActivity(options?.onActivity, {
                type: 'text_delta',
                delta: assistantMessageEvent.delta,
                text: streamedText,
              });
            }
            return;
          }

          if (event.type === 'tool_execution_start') {
            emitActivity(options?.onActivity, {
              type: 'tool_start',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
            });
            return;
          }

          if (event.type === 'tool_execution_update') {
            emitActivity(options?.onActivity, {
              type: 'tool_update',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
              summary: summarizeToolPayload(event.partialResult),
            });
            return;
          }

          if (event.type === 'tool_execution_end') {
            emitActivity(options?.onActivity, {
              type: 'tool_end',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
              summary: summarizeToolPayload(event.result),
              isError: event.isError === true,
            });
            return;
          }

          if (event.type === 'agent_end') {
            const text = findLastAssistantText(event.messages) || streamedText;
            const response = extract(text);
            emitActivity(options?.onActivity, { type: 'complete', mode, text, response });
            finish('resolve', response);
            return;
          }

          if (event.type === 'error') {
            const message = normalizeErrorMessage(event.error?.message ?? event.error);
            emitActivity(options?.onActivity, { type: 'error', message });
            finish('reject', new Error(message));
          }
        });

        session.prompt(prompt).catch((error: unknown) => {
          const message = normalizeErrorMessage(error);
          emitActivity(options?.onActivity, { type: 'error', message });
          finish('reject', new Error(message));
        });
      });
    },
  };
}

/** Creates a session that parses JSON from the AI response. */
export async function createTranslationSession(
  options?: CreateTranslationSessionOptions,
): Promise<TranslationSession> {
  return createSession('json', options);
}

/** Creates a session that returns raw text (for doc translation). */
export async function createTextSession(
  options?: CreateTranslationSessionOptions,
): Promise<TranslationSession> {
  return createSession('text', options);
}
