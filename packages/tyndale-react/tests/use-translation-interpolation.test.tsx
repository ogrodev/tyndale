// packages/tyndale-react/tests/use-translation-interpolation.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { useTranslation } from '../src/use-translation';
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

function TestConsumer({ source, vars }: { source: string; vars?: Record<string, string | number> }) {
  const t = useTranslation();
  return <span data-testid="result">{t(source, vars)}</span>;
}

describe('useTranslation — interpolation', () => {
  test('returns source when no translation exists', () => {
    renderWithCtx(<TestConsumer source="Hello" />);
    expect(screen.getByTestId('result').textContent).toBe('Hello');
  });

  test('returns translated string when available', () => {
    const source = 'Hello';
    const h = hash(source);
    renderWithCtx(<TestConsumer source={source} />, {
      locale: 'es',
      translations: { [h]: 'Hola' },
    });
    expect(screen.getByTestId('result').textContent).toBe('Hola');
  });

  test('interpolates {name} placeholders in source (fallback)', () => {
    renderWithCtx(
      <TestConsumer source="Hello, {name}!" vars={{ name: 'Pedro' }} />,
    );
    expect(screen.getByTestId('result').textContent).toBe('Hello, Pedro!');
  });

  test('interpolates {name} placeholders in translated string', () => {
    const source = 'Hello, {name}!';
    const h = hash(source);
    renderWithCtx(
      <TestConsumer source={source} vars={{ name: 'Pedro' }} />,
      { locale: 'es', translations: { [h]: '¡Hola, {name}!' } },
    );
    expect(screen.getByTestId('result').textContent).toBe('¡Hola, Pedro!');
  });

  test('interpolates multiple placeholders', () => {
    const source = '{greeting}, {name}! You have {count} messages.';
    const h = hash(source);
    renderWithCtx(
      <TestConsumer
        source={source}
        vars={{ greeting: 'Hi', name: 'Pedro', count: 5 }}
      />,
      {
        translations: {
          [h]: '{greeting}, {name}! Tienes {count} mensajes.',
        },
      },
    );
    expect(screen.getByTestId('result').textContent).toBe(
      'Hi, Pedro! Tienes 5 mensajes.',
    );
  });

  test('leaves unmatched placeholders as-is with dev warning', () => {
    const source = 'Hello, {name}!';
    const h = hash(source);
    renderWithCtx(
      <TestConsumer source={source} vars={{}} />,
      { translations: { [h]: '¡Hola, {name}!' } },
    );
    // Placeholder rendered literally when no matching variable
    expect(screen.getByTestId('result').textContent).toBe('¡Hola, {name}!');
  });

  test('works without provider (returns interpolated source)', () => {
    render(
      <TestConsumer source="Hello, {name}!" vars={{ name: 'World' }} />,
    );
    expect(screen.getByTestId('result').textContent).toBe('Hello, World!');
  });
});
