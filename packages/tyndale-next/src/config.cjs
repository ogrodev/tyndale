// packages/tyndale-next/src/config.cjs
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');

const requireFromTyndaleNext = createRequire(__filename);

/** The cookie name used by Tyndale middleware for locale persistence. */
const TYNDALE_COOKIE_NAME = 'TYNDALE_LOCALE';

function readTyndaleConfig() {
  const configPath = path.resolve(process.cwd(), 'tyndale.config.json');

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch {
    throw new Error(
      `tyndale.config.json not found at ${configPath}. Run "tyndale init" to create one.`,
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `tyndale.config.json at ${configPath} contains invalid JSON. Fix the syntax and rebuild.`,
    );
  }
}

function selectExportPath(value) {
  if (typeof value === 'string') return value;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const selected = selectExportPath(entry);
      if (selected) return selected;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') return undefined;

  for (const condition of ['import', 'node', 'default', 'require', 'bun']) {
    const selected = selectExportPath(value[condition]);
    if (selected) return selected;
  }

  return undefined;
}

function selectPackageExport(packageJson, exportKey) {
  const exportsField = packageJson.exports;

  if (exportKey !== '.') {
    return exportsField &&
      typeof exportsField === 'object' &&
      !Array.isArray(exportsField)
      ? selectExportPath(exportsField[exportKey])
      : undefined;
  }

  const rootExport =
    exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)
      ? Object.prototype.hasOwnProperty.call(exportsField, '.')
        ? exportsField['.']
        : exportsField
      : exportsField;

  return (
    selectExportPath(rootExport) ??
    (typeof packageJson.module === 'string' ? packageJson.module : undefined) ??
    (typeof packageJson.main === 'string' ? packageJson.main : undefined) ??
    'index.js'
  );
}

function resolvePackageExport(packageName, exportKey) {
  const searchPaths = requireFromTyndaleNext.resolve.paths(packageName) ?? [];

  for (const nodeModulesPath of searchPaths) {
    const packageDir = path.join(nodeModulesPath, packageName);
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;

    let packageJson;
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    } catch {
      throw new Error(`${packageName} package.json at ${packageJsonPath} is invalid JSON.`);
    }

    const selectedExport = selectPackageExport(packageJson, exportKey);
    if (!selectedExport) {
      throw new Error(
        `Unable to resolve ${packageName} ${exportKey} export from ${packageJsonPath}.`,
      );
    }

    const entryPath = path.resolve(packageDir, selectedExport);
    return fs.existsSync(entryPath) ? fs.realpathSync(entryPath) : entryPath;
  }

  throw new Error(
    `Unable to resolve ${packageName}. Install ${packageName} alongside tyndale-next.`,
  );
}

function toTurbopackAliasPath(resolvedPath) {
  const relativePath = path
    .relative(process.cwd(), resolvedPath)
    .split(path.sep)
    .join('/');

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

function withTyndaleConfig(nextConfig) {
  const tyndaleConfig = readTyndaleConfig();

  // Resolve to the exact physical paths so server and client bundles share the
  // same tyndale-react instance (prevents duplicate React contexts). Webpack
  // prefix-matches bare alias keys, so its alias is exact-only; Turbopack gets
  // explicit aliases for each public package subpath we use.
  const tyndaleReactPath = resolvePackageExport('tyndale-react', '.');
  const tyndaleReactServerPath = resolvePackageExport('tyndale-react', './server');
  const tyndaleReactTurbopackPath = toTurbopackAliasPath(tyndaleReactPath);
  const tyndaleReactServerTurbopackPath = toTurbopackAliasPath(
    tyndaleReactServerPath,
  );

  return {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      TYNDALE_DEFAULT_LOCALE: tyndaleConfig.defaultLocale,
      TYNDALE_LOCALES: JSON.stringify(tyndaleConfig.locales),
      TYNDALE_COOKIE_NAME,
      TYNDALE_LOCALE_ALIASES: JSON.stringify(
        tyndaleConfig.localeAliases ?? {},
      ),
      TYNDALE_OUTPUT: tyndaleConfig.output,
    },
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: {
        ...nextConfig.turbopack?.resolveAlias,
        'tyndale-react': tyndaleReactTurbopackPath,
        'tyndale-react/server': tyndaleReactServerTurbopackPath,
      },
    },
    webpack: (config, options) => {
      // Chain with any existing webpack function from the user's config.
      const resolved = nextConfig.webpack
        ? nextConfig.webpack(config, options)
        : config;
      delete resolved.resolve.alias['tyndale-react'];
      resolved.resolve.alias['tyndale-react$'] = tyndaleReactPath;
      return resolved;
    },
  };
}

module.exports = {
  TYNDALE_COOKIE_NAME,
  withTyndaleConfig,
};
