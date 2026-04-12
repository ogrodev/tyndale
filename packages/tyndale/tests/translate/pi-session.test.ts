// packages/tyndale/tests/translate/pi-session.test.ts
import { describe, it, expect, mock } from 'bun:test';
import { buildTranslationPrompt, parseTranslationResult, type TranslationInput } from '../../src/translate/pi-session';

describe('pi-session', () => {
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
      // Prompt should contain the hash as a key identifier
      expect(prompt).toContain('"h1"');
      expect(prompt).toContain('"Hello"');
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

  describe('createTranslationSession', () => {
    it('passes discovered authStorage to createAgentSession', async () => {
      const fakeAuthStorage = { load: () => null, store: () => {} };
      const fakeSession = { id: 'test-session' };
      let capturedOptions: Record<string, unknown> | undefined;

      mock.module('@mariozechner/pi-coding-agent', () => ({
        discoverAuthStorage: async () => fakeAuthStorage,
        SessionManager: {
          inMemory: () => ({ type: 'in-memory' }),
        },
        createAgentSession: async (opts: Record<string, unknown>) => {
          capturedOptions = opts;
          return { session: fakeSession };
        },
      }));

      // Re-import after mocking to pick up the mock
      const { createTranslationSession } = await import('../../src/translate/pi-session');
      const session = await createTranslationSession();

      expect(capturedOptions).toBeDefined();
      expect(capturedOptions!.authStorage).toBe(fakeAuthStorage);
      expect(capturedOptions!.toolNames).toEqual([]);
      expect(capturedOptions!.requireSubmitResultTool).toBe(true);
      expect(session).toBe(fakeSession);
    });
  });
});