// packages/tyndale-next/src/client-provider.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TyndaleProvider, type Manifest } from 'tyndale-react';

interface TyndaleNextClientProviderProps {
  locale: string;
  defaultLocale: string;
  translations: Record<string, string>;
  manifest: Record<string, unknown> | null;
  children: React.ReactNode;
}

/**
 * Client component that wraps TyndaleProvider from tyndale-react.
 *
 * Receives pre-loaded translations and manifest from TyndaleServerProvider
 * (avoids a second fetch on the client). Wires onLocaleChange to Next.js
 * router navigation so locale changes trigger a full navigation instead
 * of client-side state updates.
 *
 * This component is marked 'use client' and handles the server/client boundary.
 */
export function TyndaleNextClientProvider({
  locale,
  defaultLocale,
  translations,
  manifest,
  children,
}: TyndaleNextClientProviderProps) {
  /**
   * When the user calls useChangeLocale(), navigate to the new locale URL.
   * This triggers a full Next.js navigation where TyndaleServerProvider
   * loads the new locale data on the server. The URL is the single source
   * of truth for locale in Next.js.
   */
  const router = useRouter();

  const handleLocaleChange = React.useCallback(
    (newLocale: string) => {
      const currentPath = window.location.pathname;
      // Strip current locale prefix and prepend new one
      const pathWithoutLocale = currentPath.replace(
        new RegExp(`^/${locale}(?=/|$)`),
        '',
      );
      const newPath = `/${newLocale}${pathWithoutLocale || '/'}`;
      router.push(newPath);
    },
    [locale, router],
  );

  return (
    <TyndaleProvider
      locale={locale}
      defaultLocale={defaultLocale}
      initialTranslations={translations}
      initialManifest={manifest as Manifest | null}
      onLocaleChange={handleLocaleChange}
    >
      {children}
    </TyndaleProvider>
  );
}
