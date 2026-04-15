// packages/tyndale/tests/translate/pi-session.test.ts
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  buildTranslationPrompt,
  createTextSession,
  createTranslationSession,
  parseTranslationResult,
  type TranslationInput,
  type TranslationSessionActivityEvent,
} from '../../src/translate/pi-session';

let createAgentSessionImpl: ((options: unknown) => Promise<{ session: any }>) | null = null;
const capturedCreateAgentSessionOptions: unknown[] = [];

mock.module('@mariozechner/pi-coding-agent', () => ({
  AuthStorage: { create: () => ({}) },
  ModelRegistry: { create: () => ({ refresh() {} }) },
  SessionManager: { inMemory: () => ({}) },
  createAgentSession: (options: unknown) => {
    capturedCreateAgentSessionOptions.push(options);
    if (!createAgentSessionImpl) {
      throw new Error('createAgentSessionImpl not configured');
    }
    return createAgentSessionImpl(options);
  },
}));

function createFakeAgentSession(events: any[], promptError?: unknown) {
  let listener: ((event: any) => void) | undefined;

  return {
    subscribe(callback: (event: any) => void) {
      listener = callback;
      return () => {
        listener = undefined;
      };
    },
    async prompt(_prompt: string) {
      if (promptError) throw promptError;
      for (const event of events) {
        listener?.(event);
      }
    },
  };
}

describe('pi-session', () => {
  beforeEach(() => {
    capturedCreateAgentSessionOptions.length = 0;
    createAgentSessionImpl = async () => ({
      session: createFakeAgentSession([]),
    });
  });

  describe('buildTranslationPrompt', () => {
    it('builds prompt with source entries and target locale', () => {
      const entries: TranslationInput[] = [
        { hash: 'abc123', source: 'Welcome to our app', context: 'app/page.tsx:T@12', type: 'jsx' },
        { hash: 'def456', source: 'Enter your email', context: 'app/contact.tsx:useTranslation@5', type: 'string' },
      ];
      const prompt = buildTranslationPrompt(entries, 'es', 'Spanish');
      expect(prompt).toContain('Spanish');
      expect(prompt).toContain('es');
      expect(prompt).toContain('Welcome to our app');
      expect(prompt).toContain('Enter your email');
      expect(prompt).toContain('abc123');
      expect(prompt).toContain('def456');
      expect(prompt).toContain('<0>');
      expect(prompt).toContain('{name}');
    });

    it('includes instructions to preserve numbered tags and placeholders', () => {
      const entries: TranslationInput[] = [
        { hash: 'x', source: '<0>Hello</0>', context: 'a.tsx:T@1', type: 'jsx' },
      ];
      const prompt = buildTranslationPrompt(entries, 'fr', 'French');
      expect(prompt).toContain('numbered tags');
      expect(prompt).toContain('variable placeholders');
      expect(prompt).toContain('preserve');
    });

    it('formats entries as a structured list', () => {
      const entries: TranslationInput[] = [
        { hash: 'h1', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
      ];
      const prompt = buildTranslationPrompt(entries, 'ja', 'Japanese');
      expect(prompt).toContain('"h1"');
      expect(prompt).toContain('"Hello"');
    });

    it('includes brief section when brief is provided', () => {
      const entries: TranslationInput[] = [
        { hash: 'h1', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
      ];
      const brief = '## Tone\nUse informal register (tu).';
      const prompt = buildTranslationPrompt(entries, 'es', 'Spanish', brief);
      expect(prompt).toContain('TRANSLATION BRIEF:');
      expect(prompt).toContain('Use informal register (tu).');
      const briefIdx = prompt.indexOf('TRANSLATION BRIEF:');
      const rulesIdx = prompt.indexOf('CRITICAL RULES:');
      const sourceIdx = prompt.indexOf('SOURCE ENTRIES');
      expect(briefIdx).toBeGreaterThan(rulesIdx);
      expect(briefIdx).toBeLessThan(sourceIdx);
    });

    it('omits brief section when brief is undefined', () => {
      const entries: TranslationInput[] = [
        { hash: 'h1', source: 'Hello', context: 'a.tsx:T@1', type: 'jsx' },
      ];
      const prompt = buildTranslationPrompt(entries, 'es', 'Spanish');
      expect(prompt).not.toContain('TRANSLATION BRIEF:');
    });
  });

  describe('parseTranslationResult', () => {
    it('parses valid result with translations record', () => {
      const result = {
        translations: {
          abc123: 'Bienvenido a nuestra aplicación',
          def456: 'Ingrese su correo electrónico',
        },
      };
      const parsed = parseTranslationResult(result);
      expect(parsed).toEqual(result.translations);
    });

    it('returns null for missing translations key', () => {
      const parsed = parseTranslationResult({ foo: 'bar' });
      expect(parsed).toBeNull();
    });

    it('returns null for non-object translations', () => {
      const parsed = parseTranslationResult({ translations: 'not an object' });
      expect(parsed).toBeNull();
    });

    it('returns null for null input', () => {
      const parsed = parseTranslationResult(null);
      expect(parsed).toBeNull();
    });
  });

  describe('session activity normalization', () => {
    it('maps streamed text and tool execution events before resolving json responses', async () => {
      createAgentSessionImpl = async () => ({
        session: createFakeAgentSession([
          { type: 'turn_start' },
          {
            type: 'message_update',
            assistantMessageEvent: { type: 'text_delta', delta: '{"translations": {' },
          },
          { type: 'tool_execution_start', toolCallId: 'tool-1', toolName: 'read', args: { path: 'src/a.ts' } },
          {
            type: 'tool_execution_update',
            toolCallId: 'tool-1',
            toolName: 'read',
            args: { path: 'src/a.ts' },
            partialResult: {
              content: [{ type: 'text', text: 'Reading source entries' }],
            },
          },
          {
            type: 'tool_execution_end',
            toolCallId: 'tool-1',
            toolName: 'read',
            args: { path: 'src/a.ts' },
            result: {
              content: [{ type: 'text', text: '2 lines captured' }],
            },
            isError: false,
          },
          {
            type: 'message_update',
            assistantMessageEvent: { type: 'text_delta', delta: ' "abc123": "Hola"}}' },
          },
          {
            type: 'agent_end',
            messages: [
              {
                role: 'assistant',
                content: [{ type: 'text', text: '{"translations": {"abc123": "Hola"}}' }],
              },
            ],
          },
        ]),
      });

      const activity: TranslationSessionActivityEvent[] = [];
      const session = await createTranslationSession({
        onActivity: (event) => activity.push(event),
      });

      const result = await session.sendPrompt('translate this');

      expect(result).toEqual({ translations: { abc123: 'Hola' } });
      expect(activity.map((event) => event.type)).toEqual([
        'prompt_start',
        'turn_start',
        'text_delta',
        'tool_start',
        'tool_update',
        'tool_end',
        'text_delta',
        'complete',
      ]);
      expect(activity[4]).toMatchObject({
        type: 'tool_update',
        toolName: 'read',
        summary: 'Reading source entries',
      });
      expect(activity[7]).toMatchObject({
        type: 'complete',
        mode: 'json',
        text: '{"translations": {"abc123": "Hola"}}',
      });
      expect(capturedCreateAgentSessionOptions).toHaveLength(1);
      expect(capturedCreateAgentSessionOptions[0]).toMatchObject({ tools: [] });
    });

    it('returns raw text in text mode and emits normalized prompt errors', async () => {
      createAgentSessionImpl = async () => ({
        session: createFakeAgentSession([], new Error('provider unavailable')),
      });

      const activity: TranslationSessionActivityEvent[] = [];
      const session = await createTextSession({
        onActivity: (event) => activity.push(event),
      });

      try {
        await session.sendPrompt('generate brief');
        throw new Error('expected sendPrompt to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('provider unavailable');
      }
      expect(activity).toEqual([
        { type: 'prompt_start', mode: 'text' },
        { type: 'error', message: 'provider unavailable' },
      ]);
    });

    it('emits normalized session error events from the Pi runtime', async () => {
      createAgentSessionImpl = async () => ({
        session: createFakeAgentSession([
          { type: 'error', error: { message: 'agent exploded' } },
        ]),
      });

      const activity: TranslationSessionActivityEvent[] = [];
      const session = await createTranslationSession({
        onActivity: (event) => activity.push(event),
      });

      try {
        await session.sendPrompt('translate');
        throw new Error('expected sendPrompt to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('agent exploded');
      }
      expect(activity).toEqual([
        { type: 'prompt_start', mode: 'json' },
        { type: 'error', message: 'agent exploded' },
      ]);
    });
  });
});