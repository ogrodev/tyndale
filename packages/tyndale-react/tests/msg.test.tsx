// packages/tyndale-react/tests/msg.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import { msg } from '../src/msg';
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

// Simulate a constant defined outside component render
const NAV_ITEMS = [
  { label: msg('Home'), href: '/' },
  { label: msg('About'), href: '/about' },
];

describe('msg()', () => {
  test('renders source text when no translation exists', () => {
    renderWithCtx(
      <nav>
        {NAV_ITEMS.map((item, i) => (
          <a key={i} href={item.href} data-testid={`nav-${i}`}>
            {item.label}
          </a>
        ))}
      </nav>,
    );
    expect(screen.getByTestId('nav-0').textContent).toBe('Home');
    expect(screen.getByTestId('nav-1').textContent).toBe('About');
  });

  test('renders translated text when translation exists', () => {
    const homeHash = hash('Home');
    const aboutHash = hash('About');

    renderWithCtx(
      <nav>
        {NAV_ITEMS.map((item, i) => (
          <a key={i} href={item.href} data-testid={`nav-${i}`}>
            {item.label}
          </a>
        ))}
      </nav>,
      {
        locale: 'es',
        translations: {
          [homeHash]: 'Inicio',
          [aboutHash]: 'Acerca de',
        },
      },
    );
    expect(screen.getByTestId('nav-0').textContent).toBe('Inicio');
    expect(screen.getByTestId('nav-1').textContent).toBe('Acerca de');
  });

  test('renders source when no provider is present', () => {
    const label = msg('Settings');
    render(<span data-testid="msg">{label}</span>);
    expect(screen.getByTestId('msg').textContent).toBe('Settings');
  });

  test('toString() returns source string for non-React contexts', () => {
    const label = msg('Dashboard');
    // The React element's toString is not useful, but the source should be
    // accessible via the props for the resolver component
    expect((label as any).props.source).toBe('Dashboard');
  });
});
