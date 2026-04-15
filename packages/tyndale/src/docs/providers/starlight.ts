import type { DocsFramework, DocsProvider } from '../types';
import { join, relative } from 'path';
import { walkDir } from './walk';

export class StarlightProvider implements DocsProvider {
  readonly framework: DocsFramework = { id: 'starlight', name: 'Starlight' };
  readonly extensions = ['.mdx', '.md'];

  findSourceFiles(contentDir: string, locales: string[]): string[] {
    return walkDir(contentDir, this.extensions, locales);
  }

  resolveTargetPath(sourcePath: string, contentDir: string, locale: string): string {
    return join(contentDir, locale, relative(contentDir, sourcePath));
  }
}
