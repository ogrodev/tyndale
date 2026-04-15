import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { DetectedFramework, DocsFramework } from './types';

interface FrameworkSignal {
  framework: DocsFramework;
  /** npm package name; null for non-Node frameworks (MkDocs). */
  packageName: string | null;
  /** Config files to probe, in priority order — first match wins. */
  configFiles: string[];
  /** Default content directory when none is configured. */
  defaultContentDir: string;
}

const SIGNALS: FrameworkSignal[] = [
  {
    framework: { id: 'docusaurus', name: 'Docusaurus' },
    packageName: '@docusaurus/core',
    configFiles: ['docusaurus.config.js', 'docusaurus.config.ts'],
    defaultContentDir: 'docs',
  },
  {
    framework: { id: 'starlight', name: 'Starlight' },
    packageName: '@astrojs/starlight',
    configFiles: ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'],
    defaultContentDir: 'src/content/docs',
  },
  {
    framework: { id: 'vitepress', name: 'VitePress' },
    packageName: 'vitepress',
    configFiles: ['.vitepress/config.ts', '.vitepress/config.js', '.vitepress/config.mts'],
    defaultContentDir: 'docs',
  },
  {
    framework: { id: 'mkdocs', name: 'MkDocs' },
    packageName: null,
    configFiles: ['mkdocs.yml', 'mkdocs.yaml'],
    defaultContentDir: 'docs',
  },
  {
    framework: { id: 'nextra', name: 'Nextra' },
    packageName: 'nextra',
    configFiles: ['next.config.mjs', 'next.config.js', 'next.config.ts'],
    defaultContentDir: 'pages',
  },
];

function readPackageJson(root: string): { deps: Set<string> } | null {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = new Set<string>([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    return { deps };
  } catch {
    return null;
  }
}

/**
 * Scan a project root for documentation framework signals.
 * Returns one entry per detected framework, sorted by confidence (high first).
 */
export function detectDocFrameworks(root: string): DetectedFramework[] {
  const pkg = readPackageJson(root);
  const results: DetectedFramework[] = [];

  for (const signal of SIGNALS) {
    const hasDep =
      signal.packageName !== null && pkg !== null && pkg.deps.has(signal.packageName);

    const hasConfig = signal.configFiles.some((f) => existsSync(join(root, f)));

    if (!hasDep && !hasConfig) continue;

    // MkDocs has no package dep — config-only is high confidence.
    // For Node frameworks, both signals = high, one signal = medium.
    const confidence: DetectedFramework['confidence'] =
      signal.packageName === null
        ? 'high'
        : hasDep && hasConfig
          ? 'high'
          : 'medium';

    results.push({
      framework: signal.framework,
      projectRoot: root,
      contentDir: signal.defaultContentDir,
      confidence,
    });
  }

  return results;
}
