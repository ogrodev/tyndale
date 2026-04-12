// packages/tyndale/src/auth/provider-select.ts

export type Provider = 'anthropic' | 'openai' | 'google';

export interface ProviderEntry {
  id: Provider;
  displayName: string;
  defaultModel: string;
}

export const PROVIDERS: readonly ProviderEntry[] = [
  { id: 'anthropic', displayName: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-20250514' },
  { id: 'openai', displayName: 'OpenAI', defaultModel: 'gpt-4o' },
  { id: 'google', displayName: 'Google (Gemini)', defaultModel: 'gemini-2.0-flash' },
] as const;

const providerMap = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProviderDisplayName(provider: Provider): string {
  return providerMap.get(provider)!.displayName;
}

export function getDefaultModel(provider: Provider): string {
  return providerMap.get(provider)!.defaultModel;
}
