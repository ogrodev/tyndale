export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
}

/**
 * Discovers available models using Pi's ModelRegistry.
 * Returns models that have valid auth configured.
 */
export async function discoverModels(
  authStorage: import('@mariozechner/pi-coding-agent').AuthStorage,
): Promise<DiscoveredModel[]> {
  const { ModelRegistry } = await import('@mariozechner/pi-coding-agent');
  const registry = ModelRegistry.create(authStorage);
  registry.refresh();
  return registry
    .getAvailable()
    .map((m) => ({ id: m.id, name: m.name, provider: m.provider }));
}
