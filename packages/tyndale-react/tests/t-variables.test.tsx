// packages/tyndale-react/tests/t-variables.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { T } from '../src/t';
import { Var } from '../src/var';
import { Num } from '../src/num';
import { Currency } from '../src/currency';
import { DateTime } from '../src/date-time';
import { Plural } from '../src/plural';
import { hash } from '../src/hash';

function renderWithCtx(
  ui: React.ReactElement,
  overrides: Partial<TyndaleContextValue> = {},
) {
  const ctx: TyndaleContextValue = {
    locale: overrides.locale ?? 'en',
    defaultLocale: overrides.defaultLocale ?? 'en',
    translations: overrides.translations ?? {},
    manifest: overrides.manifest ?? null,
    isLoading: overrides.isLoading ?? false,
    changeLocale: () => {},
  };
  return render(
    <TyndaleContext.Provider value={ctx}>{ui}</TyndaleContext.Provider>,
  );
}

describe('<T> with variable components', () => {
  test('renders <Var> children when no translation available (fallback)', () => {
    renderWithCtx(
      <T>
        <p>
          Hello <Var name="user">Pedro</Var>
        </p>
      </T>,
    );
    expect(screen.getByText(/Hello/)).toBeTruthy();
    expect(screen.getByText(/Pedro/)).toBeTruthy();
  });

  test('applies translation with {name} variable substitution', () => {
    // Wire format for: <p>Hello <Var name="user">Pedro</Var></p>
    // → <0>Hello {user}</0>
    const wire = '<0>Hello {user}</0>';
    const h = hash(wire);
    const translated = '<0>Hola {user}</0>';

    renderWithCtx(
      <div data-testid="result">
        <T>
          <p>
            Hello <Var name="user">Pedro</Var>
          </p>
        </T>
      </div>,
      { locale: 'es', translations: { [h]: translated } },
    );
    const text = screen.getByTestId('result').textContent;
    expect(text).toBe('Hola Pedro');
  });

  test('handles <Num> inside <T> with translation', () => {
    const wire = '<0>You have {count} items</0>';
    const h = hash(wire);
    const translated = '<0>Tienes {count} artículos</0>';

    renderWithCtx(
      <div data-testid="result">
        <T>
          <p>
            You have <Num name="count" value={42} /> items
          </p>
        </T>
      </div>,
      { locale: 'es', translations: { [h]: translated } },
    );
    const text = screen.getByTestId('result').textContent;
    // Num renders 42 with es locale
    expect(text).toContain('Tienes');
    expect(text).toContain('42');
    expect(text).toContain('artículos');
  });

  test('handles <Plural> inside <T> with ICU format translation', () => {
    const wire =
      '<0>{plural, count, one {One item} other {{count} items}}</0>';
    const h = hash(wire);
    const translated =
      '<0>{plural, count, one {Un artículo} other {{count} artículos}}</0>';

    renderWithCtx(
      <div data-testid="result">
        <T>
          <p>
            <Plural count={5} one="One item" other="{count} items" />
          </p>
        </T>
      </div>,
      { locale: 'es', translations: { [h]: translated } },
    );
    const text = screen.getByTestId('result').textContent;
    expect(text).toBe('5 artículos');
  });

  test('<T> fallback renders children as-is when no translation', () => {
    renderWithCtx(
      <div data-testid="result">
        <T>
          <p>
            Price: <Currency name="price" value={9.99} currency="USD" />
          </p>
        </T>
      </div>,
    );
    const text = screen.getByTestId('result').textContent;
    expect(text).toContain('Price:');
    expect(text).toContain('$9.99');
  });

  test('handles translated wire format with reordered tags', () => {
    // Source: <h1>Hello</h1><p>World</p> → <0>Hello</0><1>World</1>
    const wire = '<0>Hello</0><1>World</1>';
    const h = hash(wire);
    // Translation reorders: paragraph before heading
    const translated = '<1>Mundo</1><0>Hola</0>';

    renderWithCtx(
      <div data-testid="result">
        <T>
          <h1>Hello</h1>
          <p>World</p>
        </T>
      </div>,
      { locale: 'es', translations: { [h]: translated } },
    );
    const el = screen.getByTestId('result');
    // Should have p before h1
    const html = el.innerHTML;
    expect(html.indexOf('<p>')).toBeLessThan(html.indexOf('<h1>'));
  });

  test('handles missing provider gracefully (renders source)', () => {
    // No provider wrapper
    render(
      <div data-testid="result">
        <T>
          <p>Hello world</p>
        </T>
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('Hello world');
  });
});
