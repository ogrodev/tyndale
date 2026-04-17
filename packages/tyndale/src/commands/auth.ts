// packages/tyndale/src/commands/auth.ts

import type { CommandResult } from '../cli.js';
import { readLine } from '../utils/readline.js';
import { exec } from 'child_process';

interface Logger {
  log(msg: string): void;
  error(msg: string): void;
}

/** Lazy import of Pi SDK to keep the dependency optional at load time. */
async function loadPiSdk() {
  return await import('@mariozechner/pi-coding-agent');
}

/** Build CLI callbacks for OAuth login flows. */
function makeOAuthCallbacks() {
  return {
    onAuth(info: { url: string; instructions?: string }) {
      process.stderr.write(`\nOpen this URL to authenticate:\n  ${info.url}\n`);
      if (info.instructions) {
        process.stderr.write(`${info.instructions}\n\n`);
      }
      // Try opening the browser; ignore failures silently.
      try {
        exec(`open ${JSON.stringify(info.url)}`);
      } catch {}
    },
    onPrompt(prompt: { message: string; placeholder?: string }) {
      return readLine(prompt.message + (prompt.placeholder ? ` (${prompt.placeholder})` : '') + ': ');
    },
    onProgress(message: string) {
      process.stderr.write(`${message}\n`);
    },
    onManualCodeInput() {
      return readLine('Paste authorization code or redirect URL: ');
    },
  };
}

/**
 * Interactive auth setup via TUI provider selector.
 * OAuth-first: OAuth providers use the full browser login flow.
 * Non-OAuth providers prompt for an API key.
 * If OAuth fails, falls back to API key.
 */
async function handleAuth(
  authStorage: import('@mariozechner/pi-coding-agent').AuthStorage,
  registry: import('@mariozechner/pi-coding-agent').ModelRegistry,
  logger: Logger,
  providerFlag?: string,
): Promise<number> {
  const allModels = registry.getAll();
  const providers = [...new Set(allModels.map((m) => m.provider))];

  if (providers.length === 0) {
    logger.error('No providers found in the model registry.');
    return 1;
  }

  const oauthProviders = authStorage.getOAuthProviders();
  const oauthMap = new Map(oauthProviders.map((p) => [p.id, p.name]));

  const providerInfos = providers.map((id) => ({
    id,
    displayName: oauthMap.get(id) ?? id,
    loggedIn: authStorage.hasAuth(id),
    isOAuth: oauthMap.has(id),
  }));

  let selected: string | null;

  if (providerFlag) {
    // --provider flag skips TUI selection
    if (!providers.includes(providerFlag)) {
      logger.error(`Unknown provider: ${providerFlag}`);
      logger.error(`Available: ${providers.join(', ')}`);
      return 1;
    }
    selected = providerFlag;
  } else {
    const { selectProvider } = await import('../tui/provider-selector.js');
    selected = await selectProvider(providerInfos);
  }

  if (!selected) {
    return 0; // User cancelled
  }

  const info = providerInfos.find((p) => p.id === selected)!;

  if (info.isOAuth) {
    // OAuth-first flow
    process.stderr.write(`\nStarting OAuth login for ${info.displayName}...\n`);
    try {
      await authStorage.login(selected, makeOAuthCallbacks());
      process.stderr.write(`✓ Authenticated with ${info.displayName} via OAuth.\n`);
      return 0;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`OAuth login failed: ${message}\n`);
      process.stderr.write(`Falling back to API key...\n`);
      // Fall through to API key
    }
  }

  // API key flow (direct for non-OAuth, fallback for failed OAuth)
  const apiKey = await readLine(`\n? Enter API key for ${info.displayName}: `);

  if (!apiKey.trim()) {
    process.stderr.write('API key cannot be empty.\n');
    return 1;
  }

  authStorage.set(selected, { type: 'api_key', key: apiKey.trim() });
  process.stderr.write(`✓ Authenticated with ${info.displayName}.\n`);
  return 0;
}

/** Shows current auth status for all logged-in providers. */
async function handleAuthStatus(
  authStorage: import('@mariozechner/pi-coding-agent').AuthStorage,
  logger: Logger,
): Promise<number> {
  const loggedIn = authStorage.list();

  if (loggedIn.length === 0) {
    logger.log('No providers authenticated. Run `tyndale auth` to set up.');
    return 1;
  }

  for (const provider of loggedIn) {
    const cred = authStorage.get(provider);
    const credType = cred?.type ?? 'unknown';
    logger.log(`  ${provider}: ${credType}`);
  }

  return 0;
}

/** Interactive logout via TUI — shows logged-in providers, user picks one. */
async function handleAuthLogout(
  authStorage: import('@mariozechner/pi-coding-agent').AuthStorage,
  logger: Logger,
): Promise<number> {
  const loggedIn = authStorage.list();

  if (loggedIn.length === 0) {
    logger.log('No credentials stored. Nothing to clear.');
    return 0;
  }

  const oauthSet = new Set(authStorage.getOAuthProviders().map((p) => p.id));
  const oauthProviders = authStorage.getOAuthProviders();
  const oauthMap = new Map(oauthProviders.map((p) => [p.id, p.name]));

  const providerInfos = loggedIn.map((id) => ({
    id,
    displayName: oauthMap.get(id) ?? id,
    loggedIn: true,
    isOAuth: oauthSet.has(id),
  }));

  const { selectProvider } = await import('../tui/provider-selector.js');
  const selected = await selectProvider(providerInfos);

  if (!selected) {
    return 0; // User cancelled
  }

  if (oauthSet.has(selected)) {
    authStorage.logout(selected);
  } else {
    authStorage.remove(selected);
  }

  process.stderr.write(`Logged out from ${oauthMap.get(selected) ?? selected}.\n`);
  return 0;
}

/** CLI entry point for `tyndale auth [status|logout]`. */
export async function runAuth(flags: Record<string, string | boolean>): Promise<CommandResult> {
  const { AuthStorage, ModelRegistry } = await loadPiSdk();
  const authStorage = AuthStorage.create();
  const registry = ModelRegistry.create(authStorage);
  registry.refresh();

  const sub = flags._sub as string | undefined;
  const providerFlag = typeof flags.provider === 'string' ? flags.provider : undefined;

  if (sub === 'status') {
    return { exitCode: await handleAuthStatus(authStorage, console) };
  } else if (sub === 'logout') {
    return { exitCode: await handleAuthLogout(authStorage, console) };
  } else {
    return { exitCode: await handleAuth(authStorage, registry, console, providerFlag) };
  }
}
