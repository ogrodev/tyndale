
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
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
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

const KNOWN_COMMANDS = ['extract', 'translate', 'auth', 'init', 'validate'] as const;

export async function routeCommand(
  command: string,
  flags: Record<string, string | boolean>,
): Promise<CommandResult> {
  switch (command) {
    case 'extract': {
      const { runExtract } = await import('./commands/extract');
      return runExtract(flags);
    }
    case 'translate': {
      const { runTranslate } = await import('./commands/translate');
      return runTranslate(flags);
    }
    case 'auth': {
      const { runAuth } = await import('./commands/auth');
      return runAuth(flags);
    }
    case 'init': {
      const { runInit } = await import('./commands/init');
      return runInit(flags);
    }
    case 'validate': {
      const { runValidate } = await import('./commands/validate');
      return runValidate(flags);
    }
    case 'help':
      printHelp();
      return { exitCode: 0 };
    default:
      console.error(`Unknown command: ${command}. Run "tyndale --help" for usage.`);
      return { exitCode: 1 };
  }
}

function printHelp(): void {
  console.log(`
tyndale — AI-powered i18n for React & Next.js

Usage: tyndale <command> [options]

Commands:
  extract     Extract translatable strings from source code
  translate   Translate extracted strings using AI
  auth        Configure AI provider authentication
  init        Initialize tyndale in your project
  validate    Validate translations without writing files

Translate options:
  --locale <code>   Translate only one locale
  --force           Retranslate all entries (ignore cache)
  --dry-run         Report delta without translating
  --batch-size <n>  Entries per AI request (default: config or 50)

General:
  --help            Show this help message
`.trim());
}

// Entry point — only runs when executed directly
if (import.meta.main) {
  const { command, flags } = parseArgs(process.argv);
  routeCommand(command, flags).then(({ exitCode }) => {
    process.exit(exitCode);
  });
}
