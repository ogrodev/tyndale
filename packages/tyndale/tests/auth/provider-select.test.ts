// packages/tyndale/tests/auth/provider-select.test.ts
import { describe, it, expect } from 'bun:test';
import {
  PROVIDERS,
  getDefaultModel,
  getProviderDisplayName,
  type Provider,
} from '../../src/auth/provider-select';

describe('provider-select', () => {
  it('has three supported providers', () => {
    expect(PROVIDERS).toHaveLength(3);
    expect(PROVIDERS.map((p) => p.id)).toEqual(['anthropic', 'openai', 'google']);
  });

  it('returns correct display names', () => {
    expect(getProviderDisplayName('anthropic')).toBe('Anthropic (Claude)');
    expect(getProviderDisplayName('openai')).toBe('OpenAI');
    expect(getProviderDisplayName('google')).toBe('Google (Gemini)');
  });

  it('returns default model per provider', () => {
    expect(getDefaultModel('anthropic')).toBe('claude-sonnet-4-20250514');
    expect(getDefaultModel('openai')).toBe('gpt-4o');
    expect(getDefaultModel('google')).toBe('gemini-2.0-flash');
  });

  it('each provider entry has id, display name, and default model', () => {
    for (const p of PROVIDERS) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.displayName).toBe('string');
      expect(typeof p.defaultModel).toBe('string');
    }
  });
});
