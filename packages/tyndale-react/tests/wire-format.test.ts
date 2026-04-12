import { describe, expect, it } from 'bun:test';
import React, { createElement } from 'react';
import { serializeChildren } from '../src/wire-format.js';

describe('serializeChildren', () => {
  it('serializes plain text', () => {
    const result = serializeChildren('Hello world');
    expect(result.wire).toBe('Hello world');
    expect(result.elementMap.length).toBe(0);
  });

  it('serializes a single element wrapping text', () => {
    // <h1>Welcome</h1>
    const children = createElement('h1', null, 'Welcome');
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Welcome</0>');
    expect(result.elementMap.length).toBe(1);
    expect(result.elementMap[0]?.type).toBe('h1');
  });

  it('serializes nested elements', () => {
    // <h1>Welcome to <strong>our app</strong></h1>
    const children = createElement('h1', null,
      'Welcome to ',
      createElement('strong', null, 'our app')
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Welcome to <1>our app</1></0>');
    expect(result.elementMap.length).toBe(2);
    expect(result.elementMap[0]?.type).toBe('h1');
    expect(result.elementMap[1]?.type).toBe('strong');
  });

  it('serializes sibling elements', () => {
    // [<h1>Title</h1>, <p>Body</p>]
    const children = [
      createElement('h1', null, 'Title'),
      createElement('p', null, 'Body'),
    ];
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Title</0><1>Body</1>');
    expect(result.elementMap.length).toBe(2);
  });

  it('preserves element props in the map', () => {
    const children = createElement('a', { href: '/home', className: 'link' }, 'Home');
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Home</0>');
    expect(result.elementMap[0]?.props).toEqual({ href: '/home', className: 'link' });
  });

  it('handles deeply nested elements', () => {
    // <div><p>Hello <em><strong>world</strong></em></p></div>
    const children = createElement('div', null,
      createElement('p', null,
        'Hello ',
        createElement('em', null,
          createElement('strong', null, 'world')
        )
      )
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0><1>Hello <2><3>world</3></2></1></0>');
  });

  it('escapes literal special characters in text', () => {
    // Text containing literal { and < characters
    const children = createElement('p', null, 'price < 100 & {tax}');
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>price &lt; 100 &amp; \\{tax\\}</0>');
  });

  it('handles null and undefined children gracefully', () => {
    const children = createElement('div', null, null, 'Hello', undefined, 'World');
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>HelloWorld</0>');
  });

  it('handles boolean children (ignored by React)', () => {
    const children = createElement('div', null, true, 'Hello', false);
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Hello</0>');
  });

  it('handles number children', () => {
    const children = createElement('span', null, 42);
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>42</0>');
  });

  it('handles empty element', () => {
    // Self-closing element like <br /> — no translatable content, but still indexed
    const children = createElement('br', null);
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0></0>');
    expect(result.elementMap.length).toBe(1);
  });

  it('handles fragments (arrays of mixed content)', () => {
    const children = ['Hello ', createElement('strong', null, 'world'), '!'];
    const result = serializeChildren(children);
    expect(result.wire).toBe('Hello <0>world</0>!');
  });

  it('normalizes insignificant whitespace', () => {
    const children = createElement('p', null, '  Hello   world  ');
    const result = serializeChildren(children);
    // Whitespace in text nodes is preserved as-is in wire format;
    // normalization happens only in hash computation, not serialization.
    expect(result.wire).toBe('<0>  Hello   world  </0>');
  });
});
