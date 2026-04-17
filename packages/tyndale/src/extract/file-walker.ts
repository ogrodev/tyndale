import { join } from 'node:path';
import { glob } from 'tinyglobby';

export interface WalkOptions {
  source: string[];
  extensions: string[];
  rootDir: string;
}

export async function walkSourceFiles(options: WalkOptions): Promise<string[]> {
  const { source, extensions, rootDir } = options;
  const files: string[] = [];

  for (const dir of source) {
    const absDir = join(rootDir, dir);

    // Build glob pattern: **/*.{ts,tsx,js,jsx}
    const extPatterns = extensions.map((e) => e.replace(/^\./, ''));
    const pattern = extPatterns.length === 1
      ? `**/*.${extPatterns[0]}`
      : `**/*.{${extPatterns.join(',')}}`;

    try {
      const matches = await glob(pattern, { cwd: absDir, absolute: true });
      for (const match of matches) {
        files.push(match);
      }
    } catch {
      // Directory doesn't exist — skip silently
    }
  }

  return files.sort();
}
