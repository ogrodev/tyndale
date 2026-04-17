// packages/tyndale/src/commands/model.ts

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { CommandResult } from '../cli.js';

/**
 * Persists the selected model to tyndale.config.json's `pi.model` field.
 * Returns false if the config file doesn't exist.
 */
function saveModelToConfig(modelKey: string, cwd: string = process.cwd()): boolean {
  const configPath = join(cwd, 'tyndale.config.json');
  if (!existsSync(configPath)) {
    return false;
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  raw.pi = { ...raw.pi, model: modelKey };
  writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
  return true;
}

/** CLI entry point for `tyndale model` */
export async function runModel(_flags: Record<string, string | boolean>): Promise<CommandResult> {
  // Check for tyndale.config.json before doing anything interactive
  const configPath = join(process.cwd(), 'tyndale.config.json');
  if (!existsSync(configPath)) {
    console.error('tyndale.config.json not found. Run `tyndale init` first.');
    return { exitCode: 1 };
  }

  const { AuthStorage, ModelRegistry } = await import('@mariozechner/pi-coding-agent');

  const authStorage = AuthStorage.create();
  const registry = ModelRegistry.create(authStorage);
  registry.refresh();

  const available = registry.getAvailable();
  if (available.length === 0) {
    console.error('No models available. Run `tyndale auth` first to configure a provider.');
    return { exitCode: 1 };
  }

  const models = available.map((m: { id: string; name: string; provider: string }) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
  }));

  const { selectModel } = await import('../tui/model-selector.js');
  const selected = await selectModel(models);

  if (!selected) {
    return { exitCode: 0 }; // User cancelled
  }

  console.log(`\n✓ Selected model: ${selected}`);
  saveModelToConfig(selected);
  return { exitCode: 0 };
}
