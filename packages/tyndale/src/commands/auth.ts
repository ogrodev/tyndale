// packages/tyndale/src/commands/auth.ts
import type { CommandResult } from '../cli';
import { readLine } from '../utils/readline';
import {
  loadCredentials,
  clearCredentials,
  storeCredentials,
  type AuthStorage,
  type StoredCredentials,
} from '../auth/credentials';
import { PROVIDERS, getProviderDisplayName, getDefaultModel, type Provider } from '../auth/provider-select';

interface Logger {
  log(msg: string): void;
  error(msg: string): void;
}

/**
 * Interactive auth setup. Reads provider selection and API key from stdin.
 * Returns exit code.
 */
export async function handleAuth(storage: AuthStorage, logger: Logger): Promise<number> {
  // Display provider menu
  logger.log('? Select your AI provider:');
  PROVIDERS.forEach((p, i) => {
    logger.log(`  ${i + 1}. ${p.displayName}`);
  });

  // Read provider choice from stdin
  process.stdout.write('Enter choice (1-3): ');
  const choiceLine = await readLine();
  const choiceIndex = parseInt(choiceLine.trim(), 10) - 1;

  if (choiceIndex < 0 || choiceIndex >= PROVIDERS.length) {
    logger.error('Invalid selection.');
    return 1;
  }

  const selected = PROVIDERS[choiceIndex];

  // Read API key from stdin
  process.stdout.write('? Enter your API key: ');
  const apiKey = (await readLine()).trim();

  if (!apiKey) {
    logger.error('API key cannot be empty.');
    return 1;
  }

  const creds: StoredCredentials = {
    provider: selected.id,
    apiKey,
    model: selected.defaultModel,
  };

  await storeCredentials(storage, creds);
  logger.log(`\u2713 Authenticated with ${selected.displayName}. Ready to translate.`);
  return 0;
}

/** Shows current auth status without revealing the API key. */
export async function handleAuthStatus(storage: AuthStorage, logger: Logger): Promise<number> {
  const creds = await loadCredentials(storage);
  if (!creds) {
    logger.log('Auth not configured. Run `tyndale auth` to set up.');
    return 1;
  }
  const displayName = getProviderDisplayName(creds.provider);
  logger.log(`Provider: ${displayName}`);
  logger.log(`Model: ${creds.model}`);
  logger.log(`API key: ${'*'.repeat(8)}...${creds.apiKey.slice(-4)}`);
  return 0;
}

/** Clears stored credentials. */
export async function handleAuthLogout(storage: AuthStorage, logger: Logger): Promise<number> {
  const creds = await loadCredentials(storage);
  if (!creds) {
    logger.log('No credentials stored. Nothing to clear.');
    return 0;
  }
  await clearCredentials(storage);
  logger.log('Logged out. Credentials cleared.');
  return 0;
}


/** CLI entry point for `tyndale auth [status|logout]` */
export async function runAuth(flags: Record<string, string | boolean>): Promise<CommandResult> {
  const { discoverAuthStorage } = await import('@mariozechner/pi-coding-agent');
  const authStorage = await discoverAuthStorage();

  // Check for subcommand via positional arg in flags or direct string check
  const sub = flags._sub as string | undefined;

  if (sub === 'status') {
    return { exitCode: await handleAuthStatus(authStorage, console) };
  } else if (sub === 'logout') {
    return { exitCode: await handleAuthLogout(authStorage, console) };
  } else {
    return { exitCode: await handleAuth(authStorage, console) };
  }
}
