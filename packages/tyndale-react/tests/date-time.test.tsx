// packages/tyndale-react/tests/date-time.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { DateTime } from '../src/date-time';

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

describe('<DateTime>', () => {
  const fixedDate = new Date('2026-04-11T12:00:00Z');

  test('formats date with en-US locale', () => {
    render(
      <Wrapper locale="en-US">
        <span data-testid="dt">
          <DateTime value={fixedDate} />
        </span>
      </Wrapper>,
    );
    const text = screen.getByTestId('dt').textContent!;
    // Default en-US format includes month/day/year
    expect(text).toContain('4/11/2026');
  });

  test('formats with de-DE locale', () => {
    render(
      <Wrapper locale="de-DE">
        <span data-testid="dt">
          <DateTime value={fixedDate} />
        </span>
      </Wrapper>,
    );
    const text = screen.getByTestId('dt').textContent!;
    expect(text).toContain('11.4.2026');
  });

  test('accepts Intl.DateTimeFormat options', () => {
    render(
      <Wrapper locale="en-US">
        <span data-testid="dt">
          <DateTime
            value={fixedDate}
            options={{ year: 'numeric', month: 'long', day: 'numeric' }}
          />
        </span>
      </Wrapper>,
    );
    expect(screen.getByTestId('dt').textContent).toBe('April 11, 2026');
  });

  test('accepts numeric timestamp', () => {
    render(
      <Wrapper locale="en-US">
        <span data-testid="dt">
          <DateTime value={fixedDate.getTime()} />
        </span>
      </Wrapper>,
    );
    const text = screen.getByTestId('dt').textContent!;
    expect(text).toContain('2026');
  });

  test('renders without provider using en fallback', () => {
    render(
      <span data-testid="dt">
        <DateTime value={fixedDate} />
      </span>,
    );
    expect(screen.getByTestId('dt').textContent!.length).toBeGreaterThan(0);
  });
});
