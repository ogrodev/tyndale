// packages/tyndale-next/src/server-provider.tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import React from 'react';
import { TyndaleNextClientProvider } from './client-provider';

/**
 * Reads a locale JSON file from the output directory.
 * Returns an empty object if the file doesn't exist or is malformed.
 * This runs on the server only — no fetch, direct filesystem read.
 */
export function loadLocaleData(
  locale: string,
  outputDir: string,
): Record<string, string> {
  const filePath = path.join(outputDir, `${locale}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Reads manifest.json from the output directory.
 * Returns null if the file doesn't exist or is malformed.
 */
export function loadManifest(outputDir: string): Record<string, unknown> | null {
  const filePath = path.join(outputDir, 'manifest.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface TyndaleServerProviderProps {
  locale: string;
  children: React.ReactNode;
}

/**
 * Server component that loads locale data from the filesystem and passes
 * it to the client provider for hydration.
 *
 * Must be used in a server component context (e.g., app/[locale]/layout.tsx).
 *
 * ```tsx
 * // app/[locale]/layout.tsx
 * import { TyndaleServerProvider } from 'tyndale-next';
 *
 * export default function LocaleLayout({ children, params }) {
 *   return (
 *     <TyndaleServerProvider locale={params.locale}>
 *       {children}
 *     </TyndaleServerProvider>
 *   );
 * }
 * ```
 */
export function TyndaleServerProvider({
  locale,
  children,
}: TyndaleServerProviderProps) {
  const defaultLocale = process.env.TYNDALE_DEFAULT_LOCALE ?? 'en';
  const outputDir = path.resolve(
    process.cwd(),
    process.env.TYNDALE_OUTPUT ?? 'public/_tyndale',
  );

  const translations = loadLocaleData(locale, outputDir);
  const manifest = loadManifest(outputDir);

  return (
    <TyndaleNextClientProvider
      locale={locale}
      defaultLocale={defaultLocale}
      translations={translations}
      manifest={manifest}
    >
      {children}
    </TyndaleNextClientProvider>
  );
}
