import type { File, JSXElement } from '@babel/types';
import _traverse from '@babel/traverse';
import { serializeJSXToWireFormat } from './jsx-serializer.js';
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

/**
 * Extract `<T>` entries from an Astro template tree. Mirrors the JSX path's
 * wire format via `serializeAstroT`. Does not recurse into nested `<T>`.
 */
import type { ParentNode, Node, TagLikeNode } from '@astrojs/compiler/types';
import { serializeAstroT } from '../astro/serializer.js';

export function extractTFromAstro(templateRoot: ParentNode, filePath: string): ExtractedEntry[] {
  const entries: ExtractedEntry[] = [];
  walk(templateRoot);
  return entries;

  function walk(node: Node): void {
    if (isTag(node, 'T')) {
      const { wire } = serializeAstroT(node as TagLikeNode);
      const line = node.position?.start.line ?? 0;
      entries.push({
        hash: computeHash(wire),
        wireFormat: wire,
        type: 'jsx',
        context: `${filePath}:T@${line}`,
      });
      return; // do not recurse into nested <T>
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
}

function isTag(node: Node, name: string): boolean {
  return (
    (node.type === 'element' || node.type === 'component' || node.type === 'custom-element') &&
    (node as { name?: string }).name === name
  );
}