import type { File, JSXElement } from '@babel/types';
import _traverse from '@babel/traverse';
import { serializeJSXToWireFormat } from './jsx-serializer';
import { computeHash } from 'tyndale-react'

const traverse = (_traverse as any).default ?? _traverse;

export interface ExtractedEntry {
  hash: string;
  wireFormat: string;
  type: 'jsx' | 'string' | 'dictionary';
  context: string;
  dictKey?: string;
  dictFile?: string;
}

export function extractTComponents(ast: File, filePath: string): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];

  traverse(ast, {
    JSXElement(path: any) {
      const opening = path.node.openingElement;
      if (
        opening.name.type === 'JSXIdentifier' &&
        opening.name.name === 'T'
      ) {
        const wireFormat = serializeJSXToWireFormat(path.node as JSXElement);
        const hash = computeHash(wireFormat);
        const line = path.node.loc?.start.line ?? 0;

        entries.push({
          hash,
          wireFormat,
          type: 'jsx',
          context: `${filePath}:T@${line}`,
        });

        // Don't traverse into nested <T> — they would be separate entries
        // but nested <T> is not a supported pattern.
        path.skip();
      }
    },
  });

  return entries;
}
