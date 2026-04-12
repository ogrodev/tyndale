// packages/tyndale/src/auth/credentials.ts

const STORAGE_KEY = 'tyndale:credentials';

export type Provider = 'anthropic' | 'openai' | 'google';

export interface StoredCredentials {
  provider: Provider;
  apiKey: string;
  model: string;
}

/**
 * Minimal interface matching Pi's AuthStorage contract.
 * Decouples credential logic from the concrete Pi implementation.
 */
export interface AuthStorage {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export async function storeCredentials(
  storage: AuthStorage,
  creds: StoredCredentials,
): Promise<void> {
  await storage.set(STORAGE_KEY, JSON.stringify(creds));
}

export async function loadCredentials(
  storage: AuthStorage,
): Promise<StoredCredentials | null> {
  const raw = await storage.get(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as StoredCredentials;
}

export async function clearCredentials(
  storage: AuthStorage,
): Promise<void> {
  await storage.delete(STORAGE_KEY);
}
