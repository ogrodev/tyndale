import { parse, type ParserOptions } from '@babel/parser';
import type { File } from '@babel/types';

const BASE_PLUGINS: ParserOptions['plugins'] = [
  'typescript',
  'jsx',
  'decorators-legacy',
];

export function parseSource(code: string, filename: string): File {
  const isTS = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const isJSX = filename.endsWith('.tsx') || filename.endsWith('.jsx');

  return parse(code, {
    sourceType: 'module',
    plugins: [
      ...(isTS ? ['typescript' as const] : []),
      ...(isJSX || !isTS ? ['jsx' as const] : []),
      'decorators-legacy' as const,
    ],
    sourceFilename: filename,
  });
}
