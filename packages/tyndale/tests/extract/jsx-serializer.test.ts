import { describe, it, expect } from 'bun:test';
import { serializeJSXToWireFormat } from '../../src/extract/jsx-serializer';
import { parseSource } from '../../src/extract/ast-parser';
import type { JSXElement, JSXFragment } from '@babel/types';
import _traverse from '@babel/traverse';

// @babel/traverse default export workaround
const traverse = (_traverse as any).default ?? _traverse;

function extractTChildren(code: string): JSXElement | JSXFragment {
  const ast = parseSource(code, 'test.tsx');
  let result: JSXElement | JSXFragment | null = null;

  traverse(ast, {
    JSXElement(path: any) {
      const opening = path.node.openingElement;
      if (
        opening.name.type === 'JSXIdentifier' &&
        opening.name.name === 'T'
      ) {
        result = path.node;
        path.stop();
      }
    },
  });

  if (!result) throw new Error('No <T> found in code');
  return result;
}

describe('serializeJSXToWireFormat', () => {
  it('serializes plain text', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = <T>Hello world</T>;
    `);
    expect(serializeJSXToWireFormat(node)).toBe('Hello world');
  });

  it('serializes single nested element', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = <T><h1>Welcome</h1></T>;
    `);
    expect(serializeJSXToWireFormat(node)).toBe('<0>Welcome</0>');
  });

  it('serializes multiple nested elements', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = (
        <T>
          <h1>Welcome to <strong>our app</strong></h1>
          <p>Start building.</p>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe(
      '<0>Welcome to <1>our app</1></0><2>Start building.</2>'
    );
  });

  it('serializes Var component as named placeholder', () => {
    const node = extractTChildren(`
      import { T, Var } from 'tyndale-react';
      const x = (
        <T>
          <p>Hello <Var name="user">{userName}</Var></p>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe('<0>Hello {user}</0>');
  });

  it('serializes Num component as named placeholder', () => {
    const node = extractTChildren(`
      import { T, Num } from 'tyndale-react';
      const x = (
        <T>
          <p>You have <Num value={count} /> items</p>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe('<0>You have {count} items</0>');
  });

  it('serializes Currency component as named placeholder', () => {
    const node = extractTChildren(`
      import { T, Currency } from 'tyndale-react';
      const x = (
        <T>
          <p>Total: <Currency value={total} currency="USD" /></p>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe('<0>Total: {total}</0>');
  });

  it('serializes DateTime component as named placeholder', () => {
    const node = extractTChildren(`
      import { T, DateTime } from 'tyndale-react';
      const x = (
        <T>
          <p>Created: <DateTime value={createdAt} /></p>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe('<0>Created: {createdAt}</0>');
  });

  it('serializes Plural as ICU plural block', () => {
    const node = extractTChildren(`
      import { T, Plural } from 'tyndale-react';
      const x = (
        <T>
          <p>You have <Plural count={n} zero="no items" one="one item" other="{count} items" /></p>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe(
      '<0>You have {plural, n, zero {no items} one {one item} other {{count} items}}</0>'
    );
  });

  it('escapes literal curly braces in text', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = <T>{'Use \\{name\\} for variables'}</T>;
    `);
    expect(serializeJSXToWireFormat(node)).toBe('Use \\{name\\} for variables');
  });

  it('normalizes whitespace', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = (
        <T>
          <h1>
            Hello    world
          </h1>
        </T>
      );
    `);
    // JSX whitespace normalization: collapse inner whitespace, trim
    expect(serializeJSXToWireFormat(node)).toBe('<0>Hello world</0>');
  });

  it('handles deeply nested elements', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = (
        <T>
          <div>
            <span>
              <em>Deep</em>
            </span>
          </div>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe('<0><1><2>Deep</2></1></0>');
  });

  it('handles mixed text and elements at same level', () => {
    const node = extractTChildren(`
      import { T } from 'tyndale-react';
      const x = (
        <T>
          Hello <strong>world</strong> and <em>universe</em>
        </T>
      );
    `);
    expect(serializeJSXToWireFormat(node)).toBe(
      'Hello <0>world</0> and <1>universe</1>'
    );
  });
});
