import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { detectDocFrameworks } from './detect.js';
import type { DetectedFramework } from './types.js';
import { createTerminalUi } from '../terminal/ui.js';

export async function runDocsSetup(
  flags: Record<string, string | boolean>,
): Promise<{ exitCode: number }> {
  const ui = createTerminalUi({
    write: console.log.bind(console),
    error: console.error.bind(console),
    decorated: process.stderr.isTTY === true,
  });

  ui.header('Translate docs setup');

  const detected = detectDocFrameworks(process.cwd());

  if (detected.length === 0) {
    ui.fail('No documentation framework detected.');
    ui.info(
      'Supported frameworks: Starlight, Docusaurus, VitePress, MkDocs, Nextra',
    );
    ui.info(
      'Ensure your project has the framework package installed or its config file present.',
    );
    return { exitCode: 1 };
  }

  ui.section('Detected frameworks');
  for (const d of detected) {
    ui.rows([
      {
        label: d.framework.name,
        value: `${d.contentDir} (${d.confidence} confidence)`,
      },
    ]);
  }

  // Pick best: first high-confidence, or first in list
  const best: DetectedFramework =
    detected.find((d) => d.confidence === 'high') ?? detected[0];

  const configPath = join(process.cwd(), 'tyndale.config.json');
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Malformed JSON — start fresh
    }
  }

  config.docs = {
    framework: best.framework.id,
    contentDir: best.contentDir,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  ui.summary('Setup complete', [
    { label: 'framework', value: best.framework.name },
    { label: 'content dir', value: best.contentDir },
    { label: 'config', value: 'tyndale.config.json updated' },
  ]);

  return { exitCode: 0 };
}
