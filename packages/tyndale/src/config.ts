import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TyndaleConfig } from 'tyndale-react';

const CONFIG_FILENAME = 'tyndale.config.json';

/**
 * Error thrown when config loading or validation fails.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Loads and validates `tyndale.config.json` from the given directory.
 * Throws `ConfigError` with a descriptive message on any failure.
 *
 * @param cwd - Directory containing the config file. Defaults to `process.cwd()`.
 */
export function loadConfig(cwd: string = process.cwd()): TyndaleConfig {
  const configPath = join(cwd, CONFIG_FILENAME);

  if (!existsSync(configPath)) {
    throw new ConfigError(
      `Config file not found: ${configPath}. ` +
      `Create a ${CONFIG_FILENAME} in your project root.`
    );
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new ConfigError(`Failed to read ${configPath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(
      `Failed to parse ${CONFIG_FILENAME}: file contains invalid JSON.`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigError(`${CONFIG_FILENAME} must be a JSON object.`);
  }

  const obj = parsed as Record<string, unknown>;

  // Required: defaultLocale
  if (!('defaultLocale' in obj) || typeof obj.defaultLocale !== 'string') {
    throw new ConfigError(
      `${CONFIG_FILENAME}: "defaultLocale" is required and must be a string.`
    );
  }

  // Required: locales
  if (!('locales' in obj) || !Array.isArray(obj.locales)) {
    throw new ConfigError(
      `${CONFIG_FILENAME}: "locales" is required and must be an array of strings.`
    );
  }

  if (obj.locales.length === 0) {
    throw new ConfigError(
      `${CONFIG_FILENAME}: "locales" must contain at least one target locale.`
    );
  }

  if (!obj.locales.every((l: unknown) => typeof l === 'string')) {
    throw new ConfigError(
      `${CONFIG_FILENAME}: "locales" must be an array of strings.`
    );
  }

  if (obj.locales.includes(obj.defaultLocale)) {
    throw new ConfigError(
      `${CONFIG_FILENAME}: "defaultLocale" must not appear in "locales". ` +
      `"locales" lists only target locales to translate into.`
    );
  }

  // Optional field validation
  if (obj.include !== undefined) {
    if (!Array.isArray(obj.include) || !obj.include.every((v: unknown) => typeof v === 'string')) {
      throw new ConfigError(`${CONFIG_FILENAME}: "include" must be an array of strings.`);
    }
  }

  if (obj.exclude !== undefined) {
    if (!Array.isArray(obj.exclude) || !obj.exclude.every((v: unknown) => typeof v === 'string')) {
      throw new ConfigError(`${CONFIG_FILENAME}: "exclude" must be an array of strings.`);
    }
  }

  if (obj.extensions !== undefined) {
    if (!Array.isArray(obj.extensions) || !obj.extensions.every((v: unknown) => typeof v === 'string')) {
      throw new ConfigError(`${CONFIG_FILENAME}: "extensions" must be an array of strings.`);
    }
  }

  if (obj.source !== undefined) {
    if (!Array.isArray(obj.source) || !obj.source.every((v: unknown) => typeof v === 'string')) {
      throw new ConfigError(`${CONFIG_FILENAME}: "source" must be an array of strings.`);
    }
  }

  if (obj.output !== undefined) {
    if (typeof obj.output !== 'string') {
      throw new ConfigError(`${CONFIG_FILENAME}: "output" must be a string.`);
    }
  }

  if (obj.batchSize !== undefined) {
    if (typeof obj.batchSize !== 'number' || !Number.isInteger(obj.batchSize) || obj.batchSize < 1) {
      throw new ConfigError(`${CONFIG_FILENAME}: "batchSize" must be a positive integer.`);
    }
  }

  if (obj.localeAliases !== undefined) {
    if (typeof obj.localeAliases !== 'object' || obj.localeAliases === null || Array.isArray(obj.localeAliases)) {
      throw new ConfigError(`${CONFIG_FILENAME}: "localeAliases" must be a Record<string, string>.`);
    }
    const aliases = obj.localeAliases as Record<string, unknown>;
    if (!Object.values(aliases).every((v) => typeof v === 'string')) {
      throw new ConfigError(`${CONFIG_FILENAME}: "localeAliases" values must be strings.`);
    }
  }

  if (obj.pi !== undefined) {
    if (typeof obj.pi !== 'object' || obj.pi === null || Array.isArray(obj.pi)) {
      throw new ConfigError(`${CONFIG_FILENAME}: "pi" must be an object.`);
    }
    const pi = obj.pi as Record<string, unknown>;
    if (pi.model !== undefined && typeof pi.model !== 'string') {
      throw new ConfigError(`${CONFIG_FILENAME}: "pi.model" must be a string.`);
    }
    if (pi.thinkingLevel !== undefined && typeof pi.thinkingLevel !== 'string') {
      throw new ConfigError(`${CONFIG_FILENAME}: "pi.thinkingLevel" must be a string.`);
    }
  }

  if (obj.dictionaries !== undefined) {
    if (typeof obj.dictionaries !== 'object' || obj.dictionaries === null || Array.isArray(obj.dictionaries)) {
      throw new ConfigError(`${CONFIG_FILENAME}: "dictionaries" must be an object.`);
    }
    const dict = obj.dictionaries as Record<string, unknown>;
    if (!Array.isArray(dict.include) || !dict.include.every((v: unknown) => typeof v === 'string')) {
      throw new ConfigError(`${CONFIG_FILENAME}: "dictionaries.include" must be an array of strings.`);
    }
    if (dict.format !== undefined && typeof dict.format !== 'string') {
      throw new ConfigError(`${CONFIG_FILENAME}: "dictionaries.format" must be a string.`);
    }
  }

  return {
    defaultLocale: obj.defaultLocale as string,
    locales: obj.locales as string[],
    include: obj.include as string[] | undefined,
    exclude: obj.exclude as string[] | undefined,
    extensions: obj.extensions as string[] | undefined,
    source: obj.source as string[] | undefined,
    output: obj.output as string | undefined,
    batchSize: obj.batchSize as number | undefined,
    localeAliases: obj.localeAliases as Record<string, string> | undefined,
    pi: obj.pi as { model?: string; thinkingLevel?: string } | undefined,
    dictionaries: obj.dictionaries as { include: string[]; format?: string } | undefined,
  };
}
