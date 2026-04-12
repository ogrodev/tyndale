// packages/tyndale-react/tests/currency.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { Currency } from '../src/currency';

function Wrapper({
  children,
  locale = 'en-US',
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  const ctx: TyndaleContextValue = {
    locale,
    defaultLocale: 'en-US',
    translations: {},
    manifest: null,
    isLoading: false,
    changeLocale: () => {},
  };
  return (
    <TyndaleContext.Provider value={ctx}>{children}</TyndaleContext.Provider>
  );
}

describe('<Currency>', () => {
  test('formats USD in en-US', () => {
    render(
      <Wrapper locale="en-US">
        <span data-testid="cur">
          <Currency value={9.99} currency="USD" />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('cur').textContent).toBe('$9.99');
  });

  test('formats EUR in de-DE', () => {
    render(
      <Wrapper locale="de-DE">
        <span data-testid="cur">
          <Currency value={1234.5} currency="EUR" />
        </span>
      </Wrapper>,
    );
    const text = screen.getByTestId('cur').textContent!;
    // German EUR format: 1.234,50 € (may include non-breaking space)
    expect(text).toContain('1.234,50');
    expect(text).toContain('€');
  });

  test('accepts additional NumberFormat options', () => {
    render(
      <Wrapper locale="en-US">
        <span data-testid="cur">
          <Currency
            value={1000}
            currency="USD"
            options={{ minimumFractionDigits: 0 }}
          />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('cur').textContent).toBe('$1,000');
  });

  test('renders without provider using en fallback', () => {
    render(
      <span data-testid="cur">
        <Currency value={5} currency="GBP" />
      </span>,
    );
    const text = screen.getByTestId('cur').textContent!;
    expect(text).toContain('5.00');
  });
});
