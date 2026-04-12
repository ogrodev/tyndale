// packages/tyndale/tests/commands/auth.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { handleAuthStatus, handleAuthLogout } from '../../src/commands/auth';
import type { AuthStorage } from '../../src/auth/credentials';
import { storeCredentials } from '../../src/auth/credentials';

class FakeAuthStorage {
  private data = new Map<string, string>();
  async get(key: string): Promise<string | undefined> { return this.data.get(key); }
  async set(key: string, value: string): Promise<void> { this.data.set(key, value); }
  async delete(key: string): Promise<void> { this.data.delete(key); }
}

describe('auth command', () => {
  let storage: FakeAuthStorage;
  let output: string[];

  beforeEach(() => {
    storage = new FakeAuthStorage();
    output = [];
  });

  const logger = {
    log: (msg: string) => output.push(msg),
    error: (msg: string) => output.push(`ERROR: ${msg}`),
  };

  describe('auth status', () => {
    it('shows "not configured" when no credentials', async () => {
      const code = await handleAuthStatus(storage, logger);
      expect(code).toBe(1);
      expect(output.some((l) => l.includes('not configured'))).toBe(true);
    });

    it('shows provider and model when credentials exist', async () => {
      await storeCredentials(storage, {
        provider: 'anthropic',
        apiKey: 'sk-ant-key',
        model: 'claude-sonnet-4-20250514',
      });
      const code = await handleAuthStatus(storage, logger);
      expect(code).toBe(0);
      expect(output.some((l) => l.includes('Anthropic (Claude)'))).toBe(true);
      expect(output.some((l) => l.includes('claude-sonnet-4-20250514'))).toBe(true);
    });

    it('does not show the API key in status', async () => {
      await storeCredentials(storage, {
        provider: 'anthropic',
        apiKey: 'sk-ant-secret',
        model: 'claude-sonnet-4-20250514',
      });
      await handleAuthStatus(storage, logger);
      expect(output.every((l) => !l.includes('sk-ant-secret'))).toBe(true);
    });
  });

  describe('auth logout', () => {
    it('clears credentials and confirms', async () => {
      await storeCredentials(storage, {
        provider: 'openai',
        apiKey: 'sk-openai-key',
        model: 'gpt-4o',
      });
      const code = await handleAuthLogout(storage, logger);
      expect(code).toBe(0);
      expect(output.some((l) => l.includes('Logged out'))).toBe(true);
    });

    it('reports nothing to clear when not authenticated', async () => {
      const code = await handleAuthLogout(storage, logger);
      expect(code).toBe(0);
      expect(output.some((l) => l.includes('No credentials'))).toBe(true);
    });
  });
});
