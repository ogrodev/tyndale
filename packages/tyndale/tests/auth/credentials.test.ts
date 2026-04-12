// packages/tyndale/tests/auth/credentials.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  storeCredentials,
  loadCredentials,
  clearCredentials,
  type StoredCredentials,
} from '../../src/auth/credentials';

/**
 * Fake AuthStorage implementing the same interface as Pi's AuthStorage.
 * Stores data in a plain Map so tests stay fast and isolated.
 */
class FakeAuthStorage {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.data.get(key);
  }
  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('credentials', () => {
  let storage: FakeAuthStorage;

  beforeEach(() => {
    storage = new FakeAuthStorage();
  });

  it('stores and loads credentials', async () => {
    const creds: StoredCredentials = {
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key',
      model: 'claude-sonnet-4-20250514',
    };
    await storeCredentials(storage, creds);
    const loaded = await loadCredentials(storage);
    expect(loaded).toEqual(creds);
  });

  it('returns null when no credentials stored', async () => {
    const loaded = await loadCredentials(storage);
    expect(loaded).toBeNull();
  });

  it('clears credentials', async () => {
    const creds: StoredCredentials = {
      provider: 'openai',
      apiKey: 'sk-openai-key',
      model: 'gpt-4o',
    };
    await storeCredentials(storage, creds);
    await clearCredentials(storage);
    const loaded = await loadCredentials(storage);
    expect(loaded).toBeNull();
  });

  it('overwrites existing credentials', async () => {
    const first: StoredCredentials = {
      provider: 'anthropic',
      apiKey: 'sk-ant-first',
      model: 'claude-sonnet-4-20250514',
    };
    const second: StoredCredentials = {
      provider: 'google',
      apiKey: 'google-key',
      model: 'gemini-pro',
    };
    await storeCredentials(storage, first);
    await storeCredentials(storage, second);
    const loaded = await loadCredentials(storage);
    expect(loaded).toEqual(second);
  });
});
