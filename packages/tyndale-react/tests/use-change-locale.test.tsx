// packages/tyndale-react/tests/use-change-locale.test.tsx
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import React, { useState, useCallback } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { TyndaleContext, type TyndaleContextValue } from '../src/context';
import {
  TyndaleInternalContext,
  type TyndaleInternalContextValue,
} from '../src/internal-context';
import { useChangeLocale } from '../src/use-change-locale';
import { useLocale } from '../src/use-locale';

// Mock fetch globally for these tests
let fetchMock: ReturnType<typeof mock>;
let fetchResolvers: Array<{
  resolve: (value: Response) => void;
  reject: (reason: any) => void;
  signal: AbortSignal;
}>;

beforeEach(() => {
  fetchResolvers = [];
  fetchMock = mock((url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      fetchResolvers.push({ resolve, reject, signal: init?.signal! });
      // If already aborted, reject immediately
      if (init?.signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      } else {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }
    });
  });
  globalThis.fetch = fetchMock as any;
});

afterEach(() => {
  // @ts-ignore
  delete globalThis.fetch;
});

function makeFetchResponse(data: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Test wrapper that provides both public and internal contexts.
 */
function TestProvider({
  children,
  initialLocale = 'en',
  initialTranslations = {},
  onLocaleChange,
}: {
  children: React.ReactNode;
  initialLocale?: string;
  initialTranslations?: Record<string, string>;
  onLocaleChange?: (locale: string) => void;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [translations, setTranslations] = useState(initialTranslations);

  const setLocaleData = useCallback(
    (newLocale: string, newTranslations: Record<string, string>) => {
      setLocale(newLocale);
      setTranslations(newTranslations);
    },
    [],
  );

  const ctxValue: TyndaleContextValue = {
    locale,
    defaultLocale: 'en',
    translations,
    manifest: null,
    isLoading: false,
    changeLocale: () => {},
  };

  const internalValue: TyndaleInternalContextValue = {
    setLocaleData,
    onLocaleChange,
    outputPath: '/_tyndale',
  };

  return (
    <TyndaleContext.Provider value={ctxValue}>
      <TyndaleInternalContext.Provider value={internalValue}>
        {children}
      </TyndaleInternalContext.Provider>
    </TyndaleContext.Provider>
  );
}

function LocaleSwitcher() {
  const locale = useLocale();
  const changeLocale = useChangeLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button data-testid="switch-es" onClick={() => changeLocale('es')}>
        ES
      </button>
      <button data-testid="switch-fr" onClick={() => changeLocale('fr')}>
        FR
      </button>
    </div>
  );
}

describe('useChangeLocale', () => {
  test('fetches locale JSON and updates context on success', async () => {
    render(
      <TestProvider>
        <LocaleSwitcher />
      </TestProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');

    // Click to switch to Spanish
    await act(async () => {
      screen.getByTestId('switch-es').click();
    });

    // Resolve the fetch
    expect(fetchResolvers.length).toBe(1);
    await act(async () => {
      fetchResolvers[0].resolve(makeFetchResponse({ abc: 'Hola' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('es');
    });
  });

  test('aborts previous fetch when new locale change requested (last-write-wins)', async () => {
    render(
      <TestProvider>
        <LocaleSwitcher />
      </TestProvider>,
    );

    // Start switching to Spanish
    await act(async () => {
      screen.getByTestId('switch-es').click();
    });
    expect(fetchResolvers.length).toBe(1);
    const firstSignal = fetchResolvers[0].signal;

    // Before Spanish resolves, switch to French
    await act(async () => {
      screen.getByTestId('switch-fr').click();
    });

    // First fetch should have been aborted
    expect(firstSignal.aborted).toBe(true);

    // Resolve the French fetch
    expect(fetchResolvers.length).toBe(2);
    await act(async () => {
      fetchResolvers[1].resolve(makeFetchResponse({ xyz: 'Bonjour' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('fr');
    });
  });

  test('calls onLocaleChange callback on success', async () => {
    const onLocaleChange = mock((_: string) => {});

    render(
      <TestProvider onLocaleChange={onLocaleChange}>
        <LocaleSwitcher />
      </TestProvider>,
    );

    await act(async () => {
      screen.getByTestId('switch-es').click();
    });

    await act(async () => {
      fetchResolvers[0].resolve(makeFetchResponse({ abc: 'Hola' }));
    });

    await waitFor(() => {
      expect(onLocaleChange).toHaveBeenCalledWith('es');
    });
  });

  test('does not update context if fetch fails (non-abort)', async () => {
    render(
      <TestProvider>
        <LocaleSwitcher />
      </TestProvider>,
    );

    await act(async () => {
      screen.getByTestId('switch-es').click();
    });

    await act(async () => {
      fetchResolvers[0].reject(new Error('Network error'));
    });

    // Locale should remain 'en'
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  test('throws when used outside provider', () => {
    function Bad() {
      try {
        useChangeLocale();
        return <div>no error</div>;
      } catch (e: any) {
        return <div data-testid="error">{e.message}</div>;
      }
    }
    render(<Bad />);
    expect(screen.getByTestId('error').textContent).toContain(
      'TyndaleProvider',
    );
  });
});
