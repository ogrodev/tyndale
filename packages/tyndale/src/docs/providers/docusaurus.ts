import type { DocsFramework, DocsProvider } from '../types.js';
import { join, relative, dirname } from 'path';
import { walkDir } from './walk.js';

export class DocusaurusProvider implements DocsProvider {
  readonly framework: DocsFramework = { id: 'docusaurus', name: 'Docusaurus' };
  readonly extensions = ['.mdx', '.md'];

  findSourceFiles(contentDir: string, locales: string[]): string[] {
    return walkDir(contentDir, this.extensions, locales);
  }

  resolveTargetPath(sourcePath: string, contentDir: string, locale: string): string {
    return join(
      dirname(contentDir),
      'i18n',
      locale,
      'docusaurus-plugin-content-docs',
      'current',
      relative(contentDir, sourcePath),
    );
  }
}
