import type { CommandResult } from '../cli';
import { readLine } from '../utils/readline';
import { readFile } from 'node:fs/promises';
import { writeFile, readFile as fsReadFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export type Framework = 'nextjs' | 'vite-react' | 'react';

export async function detectFramework(projectRoot: string): Promise<Framework> {
  const pkgPath = join(projectRoot, 'package.json');
  let raw: string;
  try {
    raw = await readFile(pkgPath, 'utf-8');
  } catch {
    throw new Error(`No package.json found at ${pkgPath}. Run this command from your project root.`);
  }

  const pkg = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (!allDeps.react) {
    throw new Error('React is not listed in dependencies. Tyndale requires a React project.');
  }

  if (allDeps.next) return 'nextjs';
  if (allDeps.vite) return 'vite-react';
  return 'react';
}

export interface InitOptions {
  defaultLocale: string;
  locales: string[];
}

export async function scaffoldConfig(
  projectRoot: string,
  options: InitOptions,
): Promise<{ framework: Framework; filesCreated: string[] }> {
  // Refuse to overwrite existing config
  const configPath = join(projectRoot, 'tyndale.config.json');
  try {
    await stat(configPath);
    throw new Error(
      'tyndale.config.json already exists. Delete it first if you want to reinitialize.',
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const framework = await detectFramework(projectRoot);
  const filesCreated: string[] = [];

  // Determine source directories based on framework
  const source = framework === 'nextjs' ? ['app', 'src'] : ['src'];

  const config = {
    defaultLocale: options.defaultLocale,
    locales: options.locales,
    source,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.astro'],
    output: 'public/_tyndale',
    translate: {},
    localeAliases: {},
    dictionaries: {
      include: ['src/dictionaries/*.json'],
      format: 'key-value',
    },
    pi: {
      model: 'claude-sonnet-4-20250514',
      thinkingLevel: 'low',
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  filesCreated.push('tyndale.config.json');

  // Update .gitignore
  await updateGitignore(projectRoot, config.output);
  filesCreated.push('.gitignore');

  // Scaffold middleware for Next.js
  if (framework === 'nextjs') {
    const middlewarePath = join(projectRoot, 'middleware.ts');
    let middlewareExists = false;
    try {
      await stat(middlewarePath);
      middlewareExists = true;
    } catch {}

    if (!middlewareExists) {
      await writeFile(middlewarePath, NEXTJS_MIDDLEWARE_TEMPLATE);
      filesCreated.push('middleware.ts');
    }
  }

  return { framework, filesCreated };
}

async function updateGitignore(
  projectRoot: string,
  outputDir: string,
): Promise<void> {
  const gitignorePath = join(projectRoot, '.gitignore');
  const entry = `${outputDir}/`;

  let content = '';
  try {
    content = await fsReadFile(gitignorePath, 'utf-8');
  } catch {}

  if (content.includes(entry)) return;

  const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await writeFile(gitignorePath, content + separator + entry + '\n');
}

const NEXTJS_MIDDLEWARE_TEMPLATE = `import { createTyndaleMiddleware } from 'tyndale-next/middleware';

export default createTyndaleMiddleware();

export const config = {
  matcher: ['/((?!api|_next|_tyndale|.*\\\\..*).*)'],
};
`;

const FRAMEWORK_NAMES: Record<Framework, string> = {
  nextjs: 'Next.js (App Router)',
  'vite-react': 'Vite + React',
  react: 'React',
};

function frameworkDisplayName(fw: Framework): string {
  return FRAMEWORK_NAMES[fw];
}

/** CLI entry point for `tyndale init` */
export async function runInit(flags: Record<string, string | boolean>): Promise<CommandResult> {
  const cwd = process.cwd();

  // Check if already initialized
  const configPath = join(cwd, 'tyndale.config.json');
  try {
    await stat(configPath);
    console.error('tyndale.config.json already exists. Remove it first to re-initialize.');
    return { exitCode: 1 };
  } catch {
    // File doesn't exist — proceed
  }

  let framework: Framework;
  try {
    framework = await detectFramework(cwd);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return { exitCode: 1 };
  }

  console.log(`? Detected framework: ${frameworkDisplayName(framework)}`);

  // Resolve default locale: flag > prompt > fallback 'en'
  let defaultLocale: string;
  if (typeof flags['default-locale'] === 'string') {
    defaultLocale = flags['default-locale'];
  } else {
    const answer = await readLine('? Default language (en): ');
    defaultLocale = answer.trim() || 'en';
  }

  // Resolve target locales: flag > prompt (required)
  let locales: string[];
  if (typeof flags['locales'] === 'string') {
    locales = flags['locales'].split(',').map((l: string) => l.trim());
  } else {
    const answer = await readLine('? Target languages (comma-separated, e.g. es,fr,ja): ');
    const trimmed = answer.trim();
    if (!trimmed) {
      console.error('Error: at least one target locale is required.');
      return { exitCode: 1 };
    }
    locales = trimmed.split(',').map((l: string) => l.trim());
  }

  try {
    const result = await scaffoldConfig(cwd, { defaultLocale, locales });
    console.log(`Created: ${result.filesCreated.join(', ')}`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    return { exitCode: 1 };
  }

  return { exitCode: 0 };
}
