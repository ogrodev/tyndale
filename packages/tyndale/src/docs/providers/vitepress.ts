import type { DocsFramework, DocsProvider } from '../types.js';
import { join, relative } from 'path';
import { walkDir } from './walk.js';

export class VitePressProvider implements DocsProvider {
  readonly framework: DocsFramework = { id: 'vitepress', name: 'VitePress' };
  readonly extensions = ['.md'];

  findSourceFiles(contentDir: string, locales: string[]): string[] {
    return walkDir(contentDir, this.extensions, locales);
  }

  resolveTargetPath(sourcePath: string, contentDir: string, locale: string): string {
    return join(contentDir, locale, relative(contentDir, sourcePath));
  }
}
