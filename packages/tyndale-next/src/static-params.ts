// packages/tyndale-next/src/static-params.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

interface LocaleParam {
  locale: string;
}

/**
 * Reads tyndale.config.json and returns an array of locale params
 * suitable for Next.js generateStaticParams().
 *
 * Returns [{ locale: defaultLocale }, ...locales.map(l => ({ locale: l }))].
 *
 * Usage:
 * ```ts
 * // app/[locale]/page.tsx
 * import { generateStaticLocaleParams } from 'tyndale-next';
 *
 * export function generateStaticParams() {
 *   return generateStaticLocaleParams();
 * }
 * ```
 */
export function generateStaticLocaleParams(): LocaleParam[] {
  const configPath = path.resolve(process.cwd(), 'tyndale.config.json');

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf-8');
  } catch {
    throw new Error(
      `tyndale.config.json not found at ${configPath}. Run "tyndale init" to create one.`,
    );
  }

  const config = JSON.parse(raw) as {
    defaultLocale: string;
    locales: string[];
  };

  return [
    { locale: config.defaultLocale },
    ...config.locales.map((l) => ({ locale: l })),
  ];
}
