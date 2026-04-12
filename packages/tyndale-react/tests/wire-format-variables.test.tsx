// packages/tyndale-react/tests/wire-format-variables.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  serializeChildren,
  deserializeWireFormat,
  parseIcuPlural,
  type VariableMap,
} from '../src/wire-format';
import { Var } from '../src/var';
import { Num } from '../src/num';
import { Currency } from '../src/currency';
import { DateTime } from '../src/date-time';
import { Plural } from '../src/plural';

describe('serializeChildren — variable components', () => {
  test('serializes <Var> as {name} placeholder', () => {
    const children = (
      <p>
        Hello <Var name="user">Pedro</Var>
      </p>
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Hello {user}</0>');
    expect(result.variableMap.get('user')).toBe('Pedro');
  });

  test('serializes <Num> as {name} placeholder', () => {
    const children = (
      <p>
        You have <Num name="count" value={42} /> items
      </p>
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>You have {count} items</0>');
    // variableMap stores a ReactElement for Num (rendered at deserialization)
    expect(result.variableMap.has('count')).toBe(true);
  });

  test('serializes <Currency> as {name} placeholder', () => {
    const children = (
      <p>
        Total: <Currency name="total" value={9.99} currency="USD" />
      </p>
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Total: {total}</0>');
    expect(result.variableMap.has('total')).toBe(true);
  });

  test('serializes <DateTime> as {name} placeholder', () => {
    const date = new Date('2026-04-11');
    const children = (
      <p>
        Date: <DateTime name="date" value={date} />
      </p>
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe('<0>Date: {date}</0>');
    expect(result.variableMap.has('date')).toBe(true);
  });

  test('serializes <Plural> as ICU format block', () => {
    const children = (
      <p>
        <Plural count={5} zero="No items" one="One item" other="{count} items" />
      </p>
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe(
      '<0>{plural, count, zero {No items} one {One item} other {{count} items}}</0>',
    );
  });

  test('serializes mixed variable and regular elements', () => {
    const children = (
      <div>
        <h1>
          Hello <Var name="user">World</Var>
        </h1>
        <p>
          You have <Num name="count" value={3} /> items
        </p>
      </div>
    );
    const result = serializeChildren(children);
    expect(result.wire).toBe(
      '<0><1>Hello {user}</1><2>You have {count} items</2></0>',
    );
    expect(result.elementMap.length).toBe(3); // div, h1, p
    expect(result.variableMap.size).toBe(2); // user, count
  });
});

describe('parseIcuPlural', () => {
  test('parses basic ICU plural block', () => {
    const result = parseIcuPlural(
      '{plural, count, zero {No items} one {One item} other {{count} items}}',
    );
    expect(result).not.toBeNull();
    expect(result!.variable).toBe('count');
    expect(result!.branches.zero).toBe('No items');
    expect(result!.branches.one).toBe('One item');
    expect(result!.branches.other).toBe('{count} items');
  });

  test('parses with nested braces in branch content', () => {
    const result = parseIcuPlural(
      '{plural, count, one {One {count} item} other {{count} items}}',
    );
    expect(result!.branches.one).toBe('One {count} item');
    expect(result!.branches.other).toBe('{count} items');
  });

  test('returns null for non-plural strings', () => {
    expect(parseIcuPlural('Hello world')).toBeNull();
    expect(parseIcuPlural('{name}')).toBeNull();
  });
});

describe('deserializeWireFormat — variables', () => {
  test('replaces {name} placeholders with variable values', () => {
    const variableMap: VariableMap = new Map([
      ['user', 'Pedro'],
      ['count', '42'],
    ]);
    const result = deserializeWireFormat(
      '<0>Hello {user}, you have {count} items</0>',
      [{ type: 'p', props: {} }],
      variableMap,
      'en',
    );
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('<p>Hello Pedro, you have 42 items</p>');
  });

  test('handles ICU plural blocks during deserialization', () => {
    const variableMap: VariableMap = new Map();
    const result = deserializeWireFormat(
      '<0>{plural, count, one {Un artículo} other {{count} artículos}}</0>',
      [{ type: 'p', props: {} }],
      variableMap,
      'es',
      5, // pluralCount
    );
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('<p>5 artículos</p>');
  });

  test('handles ICU plural with count=1', () => {
    const variableMap: VariableMap = new Map();
    const result = deserializeWireFormat(
      '{plural, count, one {One item} other {{count} items}}',
      [],
      variableMap,
      'en',
      1,
    );
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('One item');
  });

  test('preserves element props during variable substitution', () => {
    const variableMap: VariableMap = new Map([['user', 'Pedro']]);
    const result = deserializeWireFormat(
      '<0>Hello <1>{user}</1></0>',
      [
        { type: 'p', props: { className: 'greeting' } },
        { type: 'strong', props: {} },
      ],
      variableMap,
      'en',
    );
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('<p class="greeting">Hello <strong>Pedro</strong></p>');
  });
});
