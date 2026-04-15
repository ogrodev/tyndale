import type { DocsFramework, DocsProvider } from '../types';
import { extname } from 'path';
import { walkDir } from './walk';

export class NextraProvider implements DocsProvider {
  readonly framework: DocsFramework = { id: 'nextra', name: 'Nextra' };
  readonly extensions = ['.mdx', '.md'];

  findSourceFiles(contentDir: string, locales: string[]): string[] {
    return walkDir(contentDir, this.extensions, locales).filter(file => {
      // Exclude files that already have a locale suffix (e.g. intro.fr.mdx)
      const ext = extname(file);
      const stem = file.slice(0, -ext.length);
      const lastDot = stem.lastIndexOf('.');
      if (lastDot === -1) return true;
      const segment = stem.slice(lastDot + 1);
      return !locales.includes(segment);
    });
  }

  resolveTargetPath(sourcePath: string, _contentDir: string, locale: string): string {
    const ext = extname(sourcePath);
    const stem = sourcePath.slice(0, -ext.length);
    return `${stem}.${locale}${ext}`;
  }
}
