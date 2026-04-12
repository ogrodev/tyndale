import { describe, expect, it } from 'bun:test';
import React, { createElement } from 'react';
import {
  serializeChildren,
  deserializeWireFormat,
  type ElementInfo,
} from '../src/wire-format.js';

/** Helper to render React elements to a comparable structure. */
function toJSON(node: React.ReactNode): unknown {
  if (node === null || node === undefined) return null;
  if (typeof node === 'string' || typeof node === 'number') return node;
  if (Array.isArray(node)) return node.map(toJSON);
  if (React.isValidElement(node)) {
    const { children, ...props } = node.props as Record<string, unknown>;
    return {
      type: typeof node.type === 'string' ? node.type : (node.type as Function).name || 'Component',
      props,
      children: children != null
        ? Array.isArray(children) ? (children as React.ReactNode[]).map(toJSON) : toJSON(children as React.ReactNode)
        : null,
    };
  }
  return String(node);
}

describe('deserializeWireFormat', () => {
  it('deserializes plain text', () => {
    const elementMap: ElementInfo[] = [];
    const result = deserializeWireFormat('Hello world', elementMap);
    expect(result).toBe('Hello world');
  });

  it('deserializes a single element', () => {
    const elementMap: ElementInfo[] = [{ type: 'h1', props: {} }];
    const result = deserializeWireFormat('<0>Welcome</0>', elementMap);
    const json = toJSON(result);
    expect(json).toEqual({
      type: 'h1',
      props: {},
      children: 'Welcome',
    });
  });

  it('deserializes nested elements', () => {
    const elementMap: ElementInfo[] = [
      { type: 'h1', props: {} },
      { type: 'strong', props: {} },
    ];
    const result = deserializeWireFormat(
      '<0>Bienvenido a <1>nuestra app</1></0>',
      elementMap
    );
    const json = toJSON(result);
    expect(json).toEqual({
      type: 'h1',
      props: {},
      children: [
        'Bienvenido a ',
        { type: 'strong', props: {}, children: 'nuestra app' },
      ],
    });
  });

  it('deserializes sibling elements', () => {
    const elementMap: ElementInfo[] = [
      { type: 'h1', props: {} },
      { type: 'p', props: {} },
    ];
    const result = deserializeWireFormat(
      '<0>Título</0><1>Cuerpo</1>',
      elementMap
    );
    // Multiple top-level nodes returned as array
    expect(Array.isArray(result)).toBe(true);
    const json = (result as React.ReactNode[]).map(toJSON);
    expect(json).toEqual([
      { type: 'h1', props: {}, children: 'Título' },
      { type: 'p', props: {}, children: 'Cuerpo' },
    ]);
  });

  it('preserves element props in deserialized output', () => {
    const elementMap: ElementInfo[] = [
      { type: 'a', props: { href: '/home', className: 'link' } },
    ];
    const result = deserializeWireFormat('<0>Inicio</0>', elementMap);
    const json = toJSON(result);
    expect(json).toEqual({
      type: 'a',
      props: { href: '/home', className: 'link' },
      children: 'Inicio',
    });
  });

  it('handles reordered tags in translation', () => {
    const elementMap: ElementInfo[] = [
      { type: 'h1', props: {} },
      { type: 'p', props: {} },
    ];
    // Translator reordered: paragraph before heading
    const result = deserializeWireFormat(
      '<1>Cuerpo primero</1><0>Título después</0>',
      elementMap
    );
    const json = (result as React.ReactNode[]).map(toJSON) as any[];
    expect(json).toHaveLength(2);
    expect(json[0].type).toBe('p');
    expect(json[0].children).toBe('Cuerpo primero');
    expect(json[1].type).toBe('h1');
    expect(json[1].children).toBe('Título después');
  });

  it('unescapes entity-encoded text', () => {
    const elementMap: ElementInfo[] = [{ type: 'p', props: {} }];
    const result = deserializeWireFormat(
      '<0>price &lt; 100 &amp; \\{tax\\}</0>',
      elementMap
    );
    const json = toJSON(result) as any;
    expect(json.children).toBe('price < 100 & {tax}');
  });

  it('handles empty element', () => {
    const elementMap: ElementInfo[] = [{ type: 'br', props: {} }];
    const result = deserializeWireFormat('<0></0>', elementMap);
    const json = toJSON(result);
    expect(json).toEqual({
      type: 'br',
      props: {},
      children: null,
    });
  });

  it('round-trips serialize → deserialize', () => {
    const original = [
      createElement('h1', null, 'Title'),
      createElement('p', null, 'Body'),
    ];
    const { wire, elementMap } = serializeChildren(original);
    const restored = deserializeWireFormat(wire, elementMap);
    const restoredJson = (restored as React.ReactNode[]).map(toJSON) as any[];
    expect(restoredJson).toHaveLength(2);
    expect(restoredJson[0].type).toBe('h1');
    expect(restoredJson[0].children).toBe('Title');
    expect(restoredJson[1].type).toBe('p');
    expect(restoredJson[1].children).toBe('Body');
  });

  it('serialize → translate → deserialize produces translated elements', () => {
    const original = createElement('h1', null,
      'Welcome to ',
      createElement('strong', null, 'our app')
    );
    const { elementMap } = serializeChildren(original);

    // Simulate a translated wire format
    const translated = '<0>Bienvenido a <1>nuestra app</1></0>';
    const restored = deserializeWireFormat(translated, elementMap);
    const json = toJSON(restored) as any;

    expect(json.type).toBe('h1');
    expect(json.children[0]).toBe('Bienvenido a ');
    expect(json.children[1].type).toBe('strong');
    expect(json.children[1].children).toBe('nuestra app');
  });
});
