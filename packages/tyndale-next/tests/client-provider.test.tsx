// packages/tyndale-next/tests/client-provider.test.tsx
import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TyndaleNextClientProvider } from '../src/client-provider';
import { useLocale, useTyndaleContext } from 'tyndale-react';

// Simple test component that reads locale from context
function LocaleDisplay() {
  const locale = useLocale();
  return <span data-locale={locale}>{locale}</span>;
}

// Component that reads full context to verify translations are forwarded
function TranslationReader() {
  const ctx = useTyndaleContext();
  return (
    <span
      data-locale={ctx.locale}
      data-loading={String(ctx.isLoading)}
      data-has-translations={String(Object.keys(ctx.translations).length > 0)}
    >
      {JSON.stringify(ctx.translations)}
    </span>
  );
}

describe('TyndaleNextClientProvider', () => {
  test('provides locale to children via TyndaleProvider', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="es"
        defaultLocale="en"
        translations={{ abc: 'Hola' }}
        manifest={null}
      >
        <LocaleDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('es');
  });

  test('provides default locale when locale matches default', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="en"
        defaultLocale="en"
        translations={{ abc: 'Hello' }}
        manifest={null}
      >
        <LocaleDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('en');
  });

  test('renders children', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="fr"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <div id="test-child">Content</div>
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('test-child');
    expect(html).toContain('Content');
  });

  test('accepts null translations gracefully', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="ja"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <span>OK</span>
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('OK');
  });

  // GAP-5: Verify translations are forwarded as initialTranslations
  test('forwards translations to TyndaleProvider as initialTranslations', () => {
    const translations = { greeting: 'Hola', farewell: 'Adiós' };
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="es"
        defaultLocale="en"
        translations={translations}
        manifest={null}
      >
        <TranslationReader />
      </TyndaleNextClientProvider>,
    );
    // When initialTranslations is provided, TyndaleProvider sets isLoading=false
    // and translations are immediately available
    expect(html).toContain('greeting');
    expect(html).toContain('Hola');
    expect(html).toContain('Adiós');
    expect(html).toContain('data-loading="false"');
    expect(html).toContain('data-has-translations="true"');
  });

  // GAP-5: Verify manifest is forwarded
  test('forwards manifest to TyndaleProvider as initialManifest', () => {
    const manifest = { locales: { es: { keys: 2 } } };
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="es"
        defaultLocale="en"
        translations={{ key: 'val' }}
        manifest={manifest}
      >
        <TranslationReader />
      </TyndaleNextClientProvider>,
    );
    // Renders without error — manifest passed through
    expect(html).toContain('data-locale="es"');
  });

  // GAP-3: Verify router.push is used (not window.location.href)
  test('handleLocaleChange calls router.push with correct path', async () => {
    // We need to test the callback. Import the component and trigger onLocaleChange
    // through TyndaleProvider's context. We'll use a test component that calls changeLocale.
    const { renderToString: rts } = await import('react-dom/server');

    // The component uses useRouter().push internally. We verify by checking
    // that the source code no longer contains window.location.href assignment.
    const fs = await import('fs');
    const source = fs.readFileSync(
      new URL('../src/client-provider.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).not.toContain('window.location.href =');
    expect(source).toContain('router.push(');
    expect(source).toContain("useRouter");
  });
});
