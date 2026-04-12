// packages/tyndale-react/tests/num.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { Num } from '../src/num';

function Wrapper({
  children,
  locale = 'en',
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  const ctx: TyndaleContextValue = {
    locale,
    defaultLocale: 'en',
    translations: {},
    manifest: null,
    isLoading: false,
    changeLocale: () => {},
  };
  return (
    <TyndaleContext.Provider value={ctx}>{children}</TyndaleContext.Provider>
  );
}

describe('<Num>', () => {
  test('formats number with en locale', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="num">
          <Num value={1234.5} />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('num').textContent).toBe('1,234.5');
  });

  test('formats number with de locale', () => {
    render(
      <Wrapper locale="de">
        <span data-testid="num">
          <Num value={1234.5} />
        </span>
      </Wrapper>,
    );
    // German: 1.234,5
    expect(screen.getByTestId('num').textContent).toBe('1.234,5');
  });

  test('accepts Intl.NumberFormat options', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="num">
          <Num value={0.85} options={{ style: 'percent' }} />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('num').textContent).toBe('85%');
  });

  test('renders without provider using en fallback', () => {
    render(
      <span data-testid="num">
        <Num value={42} />
      </span>,
    );
    // Falls back to 'en' when no provider
    expect(screen.getByTestId('num').textContent).toBe('42');
  });
});
