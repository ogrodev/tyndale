// packages/tyndale-next/tests/direction.test.tsx
import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useDirection } from '../src/direction';
import { TyndaleNextClientProvider } from '../src/client-provider';

function DirectionDisplay() {
  const dir = useDirection();
  return <span data-dir={dir}>{dir}</span>;
}

describe('useDirection', () => {
  test('returns ltr for English', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="en"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('ltr');
  });

  test('returns rtl for Arabic', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="ar"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('rtl');
  });

  test('returns rtl for Hebrew', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="he"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('rtl');
  });

  test('returns rtl for Farsi', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="fa"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('rtl');
  });

  test('returns ltr for French', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="fr"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('ltr');
  });

  test('returns ltr for Japanese', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="ja"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('ltr');
  });

  test('returns rtl for Urdu', () => {
    const html = renderToString(
      <TyndaleNextClientProvider
        locale="ur"
        defaultLocale="en"
        translations={{}}
        manifest={null}
      >
        <DirectionDisplay />
      </TyndaleNextClientProvider>,
    );
    expect(html).toContain('rtl');
  });
});
