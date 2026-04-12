import { describe, it, expect } from 'bun:test';
import { validateTComponent, detectStaleHashes } from '../../src/extract/validator';
import { parseSource } from '../../src/extract/ast-parser';
import type { ExtractionError } from '../../src/extract/string-extractor';
import _traverse from '@babel/traverse';
import type { JSXElement } from '@babel/types';

const traverse = (_traverse as any).default ?? _traverse;

function findTElement(code: string): JSXElement {
  const ast = parseSource(code, 'test.tsx');
  let result: JSXElement | null = null;

  traverse(ast, {
    JSXElement(path: any) {
      if (
        path.node.openingElement.name.type === 'JSXIdentifier' &&
        path.node.openingElement.name.name === 'T'
      ) {
        result = path.node;
        path.stop();
      }
    },
  });

  if (!result) throw new Error('No <T> found');
  return result;
}

describe('validateTComponent', () => {
  it('passes for plain text children', () => {
    const node = findTElement(`
      import { T } from 'tyndale-react';
      const x = <T>Hello world</T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');
    expect(errors).toHaveLength(0);
  });

  it('passes for text with HTML elements', () => {
    const node = findTElement(`
      import { T } from 'tyndale-react';
      const x = <T><h1>Hello <strong>world</strong></h1></T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');
    expect(errors).toHaveLength(0);
  });

  it('passes for wrapped dynamic content using Var', () => {
    const node = findTElement(`
      import { T, Var } from 'tyndale-react';
      const x = <T><p>Hello <Var name="user">{name}</Var></p></T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');
    expect(errors).toHaveLength(0);
  });

  it('passes for Num, Currency, DateTime components', () => {
    const node = findTElement(`
      import { T, Num, Currency, DateTime } from 'tyndale-react';
      const x = (
        <T>
          <p><Num value={n} /> items costing <Currency value={price} currency="USD" /> as of <DateTime value={date} /></p>
        </T>
      );
    `);
    const errors = validateTComponent(node, 'test.tsx');
    expect(errors).toHaveLength(0);
  });

  it('passes for Plural component', () => {
    const node = findTElement(`
      import { T, Plural } from 'tyndale-react';
      const x = <T><p><Plural count={n} one="item" other="items" /></p></T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');
    expect(errors).toHaveLength(0);
  });

  it('errors on unwrapped JSX expression (dynamic content)', () => {
    const node = findTElement(`
      import { T } from 'tyndale-react';
      const x = <T><p>Hello {userName}</p></T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');

    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('error');
    expect(errors[0].message).toContain('dynamic content');
  });

  it('allows string literal expressions inside T', () => {
    const node = findTElement(`
      import { T } from 'tyndale-react';
      const x = <T>{'Hello world'}</T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');
    expect(errors).toHaveLength(0);
  });

  it('errors on dynamic content nested inside elements', () => {
    const node = findTElement(`
      import { T } from 'tyndale-react';
      const x = <T><div><span>{dynamicValue}</span></div></T>;
    `);
    const errors = validateTComponent(node, 'test.tsx');

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('dynamic content');
  });
});

describe('detectStaleHashes', () => {
  it('detects hashes in locale file but not in manifest', () => {
    const currentHashes = new Set(['aaa', 'bbb', 'ccc']);
    const existingLocaleData: Record<string, string> = {
      aaa: 'hello',
      bbb: 'world',
      ddd: 'stale entry',
      eee: 'another stale',
    };

    const warnings = detectStaleHashes(currentHashes, existingLocaleData, 'en.json');

    expect(warnings).toHaveLength(2);
    expect(warnings[0].severity).toBe('warning');
    expect(warnings.some((w) => w.message.includes('ddd'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('eee'))).toBe(true);
  });

  it('returns empty when no stale hashes', () => {
    const currentHashes = new Set(['aaa', 'bbb']);
    const existingLocaleData: Record<string, string> = {
      aaa: 'hello',
      bbb: 'world',
    };

    const warnings = detectStaleHashes(currentHashes, existingLocaleData, 'en.json');
    expect(warnings).toHaveLength(0);
  });

  it('returns empty when no existing locale data', () => {
    const currentHashes = new Set(['aaa']);
    const warnings = detectStaleHashes(currentHashes, {}, 'en.json');
    expect(warnings).toHaveLength(0);
  });
});
