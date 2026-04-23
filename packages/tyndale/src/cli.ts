#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import type { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createTerminalUi } from './terminal/ui.js';

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
}

export interface CommandResult {
  exitCode: number;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // skip 'node' and script path
  const flags: Record<string, string | boolean> = {};

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { command: 'help', flags };
  }

  const command = args[0];

  const positionals: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eqIdx = raw.indexOf('=');
      if (eqIdx !== -1) {
        flags[raw.slice(0, eqIdx)] = raw.slice(eqIdx + 1);
      } else {
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          flags[raw] = next;
          i++;
        } else {
          flags[raw] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }

  // Store positional args for subcommand routing
  if (positionals.length > 0) {
    flags._sub = positionals[0];
  }

  return { command, flags };
}

const KNOWN_COMMANDS = ['extract', 'translate', 'translate-docs', 'auth', 'model', 'init', 'validate'] as const;

export async function routeCommand(
  command: string,
  flags: Record<string, string | boolean>,
): Promise<CommandResult> {
  switch (command) {
    case 'extract': {
      const { runExtract } = await import('./commands/extract.js');
      return runExtract(flags);
    }
    case 'translate': {
      const { runTranslate } = await import('./commands/translate.js');
      return runTranslate(flags);
    }
    case 'auth': {
      const { runAuth } = await import('./commands/auth.js');
      return runAuth(flags);
    }
    case 'init': {
      const { runInit } = await import('./commands/init.js');
      return runInit(flags);
    }
    case 'validate': {
      const { runValidate } = await import('./commands/validate.js');
      return runValidate(flags);
    }
    case 'model': {
      const { runModel } = await import('./commands/model.js');
      return runModel(flags);
    }
    case 'translate-docs': {
      if (flags._sub === 'setup') {
        const { runDocsSetup } = await import('./docs/setup.js');
        return runDocsSetup(flags);
      }
      const { runTranslateDocs } = await import('./commands/translate-docs.js');
      return runTranslateDocs(flags);
    }
    case 'help':
      printHelp();
      return { exitCode: 0 };
    default:
      printUnknownCommand(command);
      return { exitCode: 1 };
  }
}

function printHelp(): void {
  const lines: string[] = [];
  const ui = createTerminalUi({
    write: (line) => lines.push(line),
    error: (line) => lines.push(line),
    decorated: process.stdout.isTTY === true,
  });

  ui.header('tyndale', 'AI-powered i18n operator console for React and Next.js');
  ui.section('Usage');
  ui.rows([{ label: 'command', value: 'tyndale <command> [options]' }]);

  ui.section('Commands');
  ui.rows([
    { label: 'extract', value: 'Extract translatable strings from source code' },
    { label: 'translate', value: 'Translate extracted strings using AI' },
    { label: 'translate-docs', value: 'Translate documentation files (MDX/MD) for any supported framework' },
    { label: 'translate-docs setup', value: 'Detect docs framework and save to config' },
    { label: 'auth', value: 'Configure AI provider authentication' },
    { label: 'model', value: 'Change the AI model for translations' },
    { label: 'init', value: 'Initialize tyndale in your project' },
    { label: 'validate', value: 'Validate translations without writing files' },
  ]);

  ui.section('Translate options');
  ui.rows([
    { label: '--locale', value: '<code> limit translation to one locale' },
    { label: '--force', value: 'retranslate all entries and docs' },
    { label: '--dry-run', value: 'report delta without translating' },
    { label: '--token-budget', value: '<n> token budget per AI batch (default: 50000)' },
    { label: '--concurrency', value: '<n> max parallel translation sessions (auto-detected)' },
  ]);

  ui.section('Translate-docs options');
  ui.rows([
    { label: '--content-dir', value: '<path> override the docs content directory' },
    { label: '--force', value: 'retranslate all docs, not just missing' },
    { label: '--concurrency', value: '<n> max parallel translation sessions' },
  ]);

  ui.section('General');
  ui.rows([{ label: '--help', value: 'Show this help message' }]);

  console.log(lines.join('\n'));
}

function printUnknownCommand(command: string): void {
  const lines: string[] = [];
  const ui = createTerminalUi({
    write: (line) => lines.push(line),
    error: (line) => lines.push(line),
    decorated: process.stderr.isTTY === true,
  });

  ui.header('Unknown command');
  ui.fail(`tyndale does not recognize "${command}".`);
  ui.info(`Known commands: ${KNOWN_COMMANDS.join(', ')}`);
  ui.info('Run `tyndale --help` for the full command reference.');

  console.error(lines.join('\n'));
}

// Entry point — only runs when executed directly.
//
// Universal ESM main-module check (works under Node and Bun, handles symlinks).
// Comparing `import.meta.url` to `process.argv[1]` by string equality breaks on
// systems where argv[1] keeps a symlink path (e.g. `/tmp`) while Node resolves
// `import.meta.url` through `realpath` (e.g. `/private/tmp`). Resolving both
// sides through `realpath` makes the comparison robust.
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
    );
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void runCliEntrypoint();
}

async function runCliEntrypoint(): Promise<void> {
  let exitCode = 0;
  try {
    const { command, flags } = parseArgs(process.argv);
    const result = await routeCommand(command, flags);
    exitCode = result.exitCode;
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error(message);
    exitCode = 1;
  }

  // Flush any buffered stdio before exiting. Without this, `process.exit`
  // can terminate before piped stdout finishes writing, producing empty
  // output when the CLI is spawned with pipes.
  await drainStdio();

  // Force exit after stdio drains. Commands should still clean up their own
  // handles, but the CLI cannot rely on the event loop to empty on Windows:
  // translate/auth/model dependencies (undici HTTP pools, proper-lockfile,
  // readline/TUI stdin) can keep it alive indefinitely. `runCliEntrypoint`
  // is the last-resort termination boundary for the CLI process.
  process.exit(exitCode);
}

async function drainStdio(): Promise<void> {
  await Promise.all([drainStream(process.stdout), drainStream(process.stderr)]);
}

export function drainStream(stream: Writable): Promise<void> {
  if (stream.writableEnded || stream.destroyed || stream.writableLength === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      stream.off('close', finish);
      stream.off('error', finish);
      resolve();
    };

    // Empty writes invoke their callback once prior buffered output has
    // flushed, even when the stream never entered backpressure and would
    // never emit `drain`.
    stream.once('close', finish);
    stream.once('error', finish);
    try {
      stream.write('', finish);
    } catch {
      finish();
    }
  });
}
