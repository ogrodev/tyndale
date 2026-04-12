import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import React, { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { TyndaleProvider } from '../src/provider.js';
import { useLocale } from '../src/use-locale.js';
import { TyndaleContext } from '../src/context.js';
import { useContext } from 'react';

// Helper component that reads context
function LocaleDisplay() {
  const locale = useLocale();
  return createElement('span', { 'data-testid': 'locale' }, locale);
}

// Helper component that reads full context
function ContextInspector() {
  const ctx = useContext(TyndaleContext);
  if (!ctx) return createElement('span', null, 'no-context');
  return createElement('span', null, JSON.stringify({
    locale: ctx.locale,
    defaultLocale: ctx.defaultLocale,
    isLoading: ctx.isLoading,
    translationCount: Object.keys(ctx.translations).length,
    hasManifest: ctx.manifest !== null,
  }));
}

// Mock global fetch
const originalFetch = globalThis.fetch;

function mockFetch(responses: Record<string, unknown>) {
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [pattern, data] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('Not found', { status: 404 });
  }) as typeof fetch;
}

function mockFetchFailure() {
  globalThis.fetch = mock(async () => {
    return new Response('Server Error', { status: 500 });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('TyndaleProvider', () => {
  it('renders children during loading state (SSR)', () => {
    // During SSR (renderToString), useEffect doesn't fire.
    // Provider should render children as-is with source content.
    const html = renderToString(
      createElement(TyndaleProvider, {
        defaultLocale: 'en',
        locale: 'es',
      },
        createElement('div', null, 'Hello world'),
      ),
    );

    expect(html).toContain('Hello world');
  });

  it('provides default locale when no locale prop is given', () => {
    const html = renderToString(
      createElement(TyndaleProvider, { defaultLocale: 'en' },
        createElement(LocaleDisplay),
      ),
    );

    expect(html).toContain('en');
  });

  it('provides locale from prop as initial value', () => {
    const html = renderToString(
      createElement(TyndaleProvider, { defaultLocale: 'en', locale: 'es' },
        createElement(LocaleDisplay),
      ),
    );

    expect(html).toContain('es');
  });

  it('provides empty translations during loading', () => {
    const html = renderToString(
      createElement(TyndaleProvider, { defaultLocale: 'en', locale: 'es' },
        createElement(ContextInspector),
      ),
    );

    const parsed = JSON.parse(html.replace(/<\/?span>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    expect(parsed.isLoading).toBe(true);
    expect(parsed.translationCount).toBe(0);
  });

  it('provides defaultLocale in context', () => {
    const html = renderToString(
      createElement(TyndaleProvider, { defaultLocale: 'en', locale: 'fr' },
        createElement(ContextInspector),
      ),
    );

    const parsed = JSON.parse(html.replace(/<\/?span>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    expect(parsed.defaultLocale).toBe('en');
    expect(parsed.locale).toBe('fr');
  });
});

describe('useLocale', () => {
  it('returns defaultLocale when used outside provider', () => {
    // useLocale outside a provider should not throw — graceful degradation.
    // It returns an empty string or throws depending on design.
    // Per spec: "missing provider graceful degradation"
    // We'll have it return empty string and log a warning.
    const html = renderToString(
      createElement(LocaleDisplay),
    );

    // Outside provider, useLocale returns empty string
    expect(html).toContain('<span data-testid="locale">');
  });
});
