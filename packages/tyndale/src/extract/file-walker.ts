import { join } from 'path';
import { Glob } from 'bun';

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

    const glob = new Glob(pattern);

    try {
      for await (const match of glob.scan({ cwd: absDir, absolute: true })) {
        files.push(match);
      }
    } catch {
      // Directory doesn't exist — skip silently
    }
  }

  return files.sort();
}
