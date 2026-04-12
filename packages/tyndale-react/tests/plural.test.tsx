// packages/tyndale-react/tests/plural.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { Plural } from '../src/plural';

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

describe('<Plural>', () => {
  test('selects "one" for count=1 in English', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="p">
          <Plural count={1} one="One item" other="{count} items" />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('p').textContent).toBe('One item');
  });

  test('selects "other" for count=5 in English', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="p">
          <Plural count={5} one="One item" other="{count} items" />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('p').textContent).toBe('5 items');
  });

  test('interpolates {count} in branch text', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="p">
          <Plural count={42} one="One item" other="You have {count} items" />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('p').textContent).toBe('You have 42 items');
  });

  test('selects "zero" when provided and count=0', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="p">
          <Plural
            count={0}
            zero="No items"
            one="One item"
            other="{count} items"
          />
        </span>
      </Wrapper>,
    );
    // Intl.PluralRules('en').select(0) returns 'other', but we
    // explicitly check zero prop first when count === 0
    expect(screen.getByTestId('p').textContent).toBe('No items');
  });

  test('falls back to "other" when category not provided', () => {
    render(
      <Wrapper locale="en">
        <span data-testid="p">
          <Plural count={0} one="One item" other="{count} items" />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('p').textContent).toBe('0 items');
  });

  test('works with Arabic "few" category', () => {
    render(
      <Wrapper locale="ar">
        <span data-testid="p">
          <Plural
            count={3}
            zero="لا عناصر"
            one="عنصر واحد"
            two="عنصران"
            few="{count} عناصر"
            many="{count} عنصرًا"
            other="{count} عنصر"
          />
        </span>
      </Wrapper>,
    );
    // Arabic: 3 triggers 'few'
    expect(screen.getByTestId('p').textContent).toBe('3 عناصر');
  });

  test('renders without provider using en fallback', () => {
    render(
      <span data-testid="p">
        <Plural count={2} one="One item" other="{count} items" />
      </span>,
    );
    expect(screen.getByTestId('p').textContent).toBe('2 items');
  });
});
