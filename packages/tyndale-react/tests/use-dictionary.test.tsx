// packages/tyndale-react/tests/use-dictionary.test.tsx
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  TyndaleContext,
  type TyndaleContextValue,
} from '../src/context';
import type { Manifest } from '../src/types';
import { useDictionary } from '../src/use-dictionary';

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

function DictConsumer({ filenameKey }: { filenameKey: string }) {
  const dict = useDictionary(filenameKey);
  return (
    <div>
      {Object.entries(dict).map(([key, value]) => (
        <span key={key} data-testid={`dict-${key}`}>
          {value}
        </span>
      ))}
      <span data-testid="dict-size">{Object.keys(dict).length}</span>
    </div>
  );
}

describe('useDictionary', () => {
  const manifest: Manifest = {
    version: 1,
    defaultLocale: 'en',
    locales: ['es'],
    entries: {
      hash_greeting: {
        type: 'dictionary',
        context: 'src/dictionaries/common.json',
        dictKey: 'greeting',
        dictFile: 'common',
      },
      hash_farewell: {
        type: 'dictionary',
        context: 'src/dictionaries/common.json',
        dictKey: 'farewell',
        dictFile: 'common',
      },
      hash_title: {
        type: 'dictionary',
        context: 'src/dictionaries/pages/home.json',
        dictKey: 'title',
        dictFile: 'pages/home',
      },
      hash_jsx: {
        type: 'jsx',
        context: 'app/page.tsx:T@12',
      },
    },
  };

  test('returns translated dict entries for the given filenameKey', () => {
    renderWithCtx(
      <DictConsumer filenameKey="common" />,
      {
        manifest,
        translations: {
          hash_greeting: 'Hola',
          hash_farewell: 'Adiós',
          hash_title: 'Inicio',
        },
      },
    );
    expect(screen.getByTestId('dict-greeting').textContent).toBe('Hola');
    expect(screen.getByTestId('dict-farewell').textContent).toBe('Adiós');
    expect(screen.getByTestId('dict-size').textContent).toBe('2');
  });

  test('returns only entries matching the filenameKey', () => {
    renderWithCtx(
      <DictConsumer filenameKey="pages/home" />,
      {
        manifest,
        translations: {
          hash_greeting: 'Hola',
          hash_farewell: 'Adiós',
          hash_title: 'Inicio',
        },
      },
    );
    expect(screen.getByTestId('dict-title').textContent).toBe('Inicio');
    expect(screen.getByTestId('dict-size').textContent).toBe('1');
  });

  test('returns empty object when no manifest available', () => {
    renderWithCtx(<DictConsumer filenameKey="common" />, {
      manifest: null,
      translations: { hash_greeting: 'Hola' },
    });
    expect(screen.getByTestId('dict-size').textContent).toBe('0');
  });

  test('returns empty object when filenameKey has no matching entries', () => {
    renderWithCtx(<DictConsumer filenameKey="nonexistent" />, {
      manifest,
      translations: { hash_greeting: 'Hola' },
    });
    expect(screen.getByTestId('dict-size').textContent).toBe('0');
  });

  test('falls back to hash key when translation missing', () => {
    renderWithCtx(<DictConsumer filenameKey="common" />, {
      manifest,
      translations: {
        hash_greeting: 'Hola',
        // hash_farewell missing
      },
    });
    expect(screen.getByTestId('dict-greeting').textContent).toBe('Hola');
    // Missing translation: the dictKey itself could be used as fallback
    expect(screen.getByTestId('dict-size').textContent).toBe('2');
  });

  test('throws when used outside provider', () => {
    function Bad() {
      try {
        useDictionary('common');
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
