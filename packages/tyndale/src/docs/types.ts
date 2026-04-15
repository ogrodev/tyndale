export interface DocsFramework {
  id: DocsFrameworkId;
  name: string;
}

export type DocsFrameworkId =
  | 'starlight'
  | 'docusaurus'
  | 'vitepress'
  | 'mkdocs'
  | 'nextra';

export interface DocsProviderConfig {
  framework: DocsFrameworkId;
  /** Where English source docs live (absolute or relative to project root). */
  contentDir: string;
  /** File extensions to scan. */
  extensions: string[];
  /** Extra provider-specific options. */
  options?: Record<string, unknown>;
}

export interface DocsProvider {
  readonly framework: DocsFramework;

  /** Discover all source doc files (English / default locale). */
  findSourceFiles(contentDir: string, locales: string[]): string[];

  /** Given a source file path and a target locale, return the output path. */
  resolveTargetPath(sourcePath: string, contentDir: string, locale: string): string;

  /** File extensions this provider handles. */
  extensions: string[];
}

export interface DetectedFramework {
  framework: DocsFramework;
  /** Path to the project root where this was detected (may differ from repo root in monorepo). */
  projectRoot: string;
  /** Inferred content directory. */
  contentDir: string;
  /** Confidence: 'high' (config file + dep found), 'medium' (only one signal). */
  confidence: 'high' | 'medium';
}
