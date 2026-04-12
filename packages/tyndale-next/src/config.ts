// packages/tyndale-next/src/config.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

/** The cookie name used by Tyndale middleware for locale persistence. */
export const TYNDALE_COOKIE_NAME = 'TYNDALE_LOCALE';

interface TyndaleConfigFile {
  defaultLocale: string;
  locales: string[];
  output: string;
  localeAliases: Record<string, string>;
}

interface WebpackConfig {
  resolve: {
    alias: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type WebpackOptions = Record<string, unknown>;

interface NextConfig {
  env?: Record<string, string>;
  webpack?: (config: WebpackConfig, options: WebpackOptions) => WebpackConfig;
  [key: string]: unknown;
}

/**
 * Reads tyndale.config.json from the project root (cwd).
 * Throws at build time with a clear message if not found or malformed.
 */
function readTyndaleConfig(): TyndaleConfigFile {
  const configPath = path.resolve(process.cwd(), 'tyndale.config.json');

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch {
    throw new Error(
      `tyndale.config.json not found at ${configPath}. Run "tyndale init" to create one.`,
    );
  }

  try {
    return JSON.parse(raw) as TyndaleConfigFile;
  } catch {
    throw new Error(
      `tyndale.config.json at ${configPath} contains invalid JSON. Fix the syntax and rebuild.`,
    );
  }
}

/**
 * Wraps a Next.js config to inject Tyndale build-time constants.
 *
 * Reads tyndale.config.json from the project root and sets environment
 * variables that the middleware and providers read at runtime:
 *
 * - TYNDALE_DEFAULT_LOCALE — the default locale code
 * - TYNDALE_LOCALES — JSON array of target locale codes
 * - TYNDALE_COOKIE_NAME — cookie name for locale persistence
 * - TYNDALE_LOCALE_ALIASES — JSON object of alias mappings
 * - TYNDALE_OUTPUT — output directory path
 *
 * Usage in next.config.ts:
 * ```ts
 * import { withTyndaleConfig } from 'tyndale-next/config';
 * export default withTyndaleConfig({});
 * ```
 */
export function withTyndaleConfig(nextConfig: NextConfig): NextConfig {
  const tyndaleConfig = readTyndaleConfig();

  // Resolve to the exact physical path so server and client bundles
  // share the same tyndale-react instance (prevents duplicate React contexts).
  const tyndaleReactPath = require.resolve('tyndale-react');

  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      TYNDALE_DEFAULT_LOCALE: tyndaleConfig.defaultLocale,
      TYNDALE_LOCALES: JSON.stringify(tyndaleConfig.locales),
      TYNDALE_COOKIE_NAME: TYNDALE_COOKIE_NAME,
      TYNDALE_LOCALE_ALIASES: JSON.stringify(
        tyndaleConfig.localeAliases ?? {},
      ),
      TYNDALE_OUTPUT: tyndaleConfig.output,
    },
    webpack: (config, options) => {
      // Chain with any existing webpack function from the user's config.
      const resolved = nextConfig.webpack
        ? nextConfig.webpack(config, options)
        : config;
      resolved.resolve.alias['tyndale-react'] = tyndaleReactPath;
      return resolved;
    },
  };
}
