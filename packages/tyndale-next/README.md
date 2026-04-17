<!-- prettier-ignore -->
<div align="center">
  <img src="https://raw.githubusercontent.com/ogrodev/tyndale/main/apps/website/public/favicon.svg" alt="Tyndale logo" width="64" height="64" />

# tyndale-next

[![npm version](https://img.shields.io/npm/v/tyndale-next?style=flat-square)](https://www.npmjs.com/package/tyndale-next)
[![Build Status](https://img.shields.io/github/actions/workflow/status/ogrodev/tyndale/ci.yml?style=flat-square&label=CI)](https://github.com/ogrodev/tyndale/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](../../LICENSE)

Next.js adapter for [Tyndale](https://github.com/ogrodev/tyndale) — locale routing, server-side rendering, and static generation support for the App Router.

</div>

## Overview

`tyndale-next` bridges Tyndale's translation runtime with Next.js App Router conventions. It handles:

- **Locale routing** — middleware that detects locale from URL, cookie, or `Accept-Language`, redirects to the correct locale prefix, and normalizes aliases
- **Server-side rendering** — a server component that reads locale files from disk before the page renders, eliminating any client-side loading flash
- **Static generation** — a helper that reads `tyndale.config.json` and returns all locale params for `generateStaticParams()`
- **Text direction** — utilities to get `ltr`/`rtl` for the current locale, usable in both server and client components

> [!NOTE]
> This package requires [`tyndale-react`](../tyndale-react) for the translation runtime and the `tyndale` CLI to extract and translate strings.

## Installation

```bash
npm install tyndale-next
# or
bun add tyndale-next
```

**Peer dependencies:** Next.js ≥ 14 and React ≥ 18.

## Setup

### 1. Wrap your Next.js config

```js
// next.config.mjs
import { withTyndaleConfig } from 'tyndale-next/config';

export default withTyndaleConfig({
  // your existing Next.js config
});
```

`withTyndaleConfig` reads `tyndale.config.json` and injects the build-time environment variables the middleware and providers need at runtime. It also aliases `tyndale-react` so the server and client bundles share a single React context.

### 2. Add the middleware

```ts
// middleware.ts (project root)
import { createTyndaleMiddleware } from 'tyndale-next/middleware';

export default createTyndaleMiddleware();

export const config = {
  matcher: ['/((?!api|_next|_tyndale|.*\\..*).*)'],
};
```

The middleware handles locale detection (URL → cookie → `Accept-Language` → default), redirects to locale-prefixed routes, resolves locale aliases, and persists the active locale in a cookie.

### 3. Add the server provider to your layout

Create an `app/[locale]/` directory if you don't have one, and add a layout that wraps children in `TyndaleServerProvider`:

```tsx
// app/[locale]/layout.tsx
import { getDirection, TyndaleServerProvider } from 'tyndale-next/server';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <TyndaleServerProvider locale={locale}>
          {children}
        </TyndaleServerProvider>
      </body>
    </html>
  );
}
```

`TyndaleServerProvider` reads the locale JSON file from disk on the server and forwards it to the client provider as `initialTranslations`, so no fetch is needed on the client.

> [!IMPORTANT]
> `TyndaleServerProvider` does not set `<html dir>`. Call `getDirection(locale)` (server) or `useDirection()` (client) to get the correct value and set it yourself.

### 4. Enable static generation (optional)

If you use `output: 'export'` or want to pre-render all locale pages:

```ts
// app/[locale]/page.tsx
import { generateStaticLocaleParams } from 'tyndale-next';

export function generateStaticParams() {
  return generateStaticLocaleParams();
}
```

This reads `tyndale.config.json` at build time and returns `[{ locale: 'en' }, { locale: 'es' }, ...]`.

## How it works

The three pieces fit together in this order:

1. **Build time** — `withTyndaleConfig` reads `tyndale.config.json` and bakes `defaultLocale`, `locales`, `localeAliases`, and `output` into `process.env` so the middleware and providers can read them without touching the filesystem at runtime on the edge.
2. **Request time** — the middleware inspects the incoming URL, cookie, and `Accept-Language` header, picks the best locale, and either redirects (when no locale prefix is in the URL) or rewrites with an `x-tyndale-locale` header.
3. **Render time** — `TyndaleServerProvider` runs in a React Server Component, reads the locale JSON directly from the filesystem, and passes translations as props to the client boundary. Components from `tyndale-react` (`<T>`, `useTranslation()`, etc.) receive translations via context and render without a loading state.

## API reference

### `withTyndaleConfig(nextConfig)` — `tyndale-next/config`

Wraps a Next.js config object. Reads `tyndale.config.json` from the project root and sets the environment variables used by the middleware and providers.

### `createTyndaleMiddleware()` — `tyndale-next/middleware`

Returns a Next.js middleware function. Locale detection priority: URL path prefix → cookie → `Accept-Language` header → default locale.

| Condition | Behavior |
|---|---|
| No locale prefix in URL | Redirects to `/{detectedLocale}/current-path` |
| URL has alias locale | Redirects to `/{canonicalLocale}/rest-of-path` |
| URL has unsupported locale | Redirects to `/{defaultLocale}/rest-of-path` |
| URL has valid locale | Rewrites, sets `x-tyndale-locale` header, updates cookie |

### `TyndaleServerProvider` — `tyndale-next` or `tyndale-next/server`

Server component. Loads locale data from disk and passes it to the client provider.

| Prop | Type | Description |
|---|---|---|
| `locale` | `string` | The active locale code, typically from route params |
| `children` | `ReactNode` | Page content |

### `generateStaticLocaleParams()` — `tyndale-next` or `tyndale-next/server`

Returns `{ locale: string }[]` containing the default locale followed by all target locales from `tyndale.config.json`. Use it as the body of `generateStaticParams()`.

### `useDirection()` — `tyndale-next`

Client hook. Returns `'ltr'` or `'rtl'` for the locale currently in context.

### `getDirection(locale)` — `tyndale-next` or `tyndale-next/server`

Server utility. Returns `'ltr'` or `'rtl'` for any locale string. Use this in server components where hooks are not available.

### `TyndaleCache` — `tyndale-next`

Client component. Memoizes translated content keyed on `id` and the current locale. Useful in shared layouts to avoid re-rendering expensive translation trees on every navigation.

```tsx
import { TyndaleCache } from 'tyndale-next';

<TyndaleCache id="footer">
  <T><footer>Large footer content...</footer></T>
</TyndaleCache>
```

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Unique key for this cache boundary |
| `children` | `ReactNode` | Content to memoize |

### `isRtlLocale(locale)` / `resolveAlias(locale, aliases)` — advanced

Lower-level locale utilities re-exported for custom use cases. `isRtlLocale` checks a BCP 47 locale string against the internal RTL set. `resolveAlias` maps a locale code through a `Record<string, string>` alias map.

## Entrypoints

| Import path | What it exports | Notes |
|---|---|---|
| `tyndale-next` | `TyndaleServerProvider`, `TyndaleNextClientProvider`, `generateStaticLocaleParams`, `useDirection`, `TyndaleCache`, `getDirection`, `isRtlLocale`, `resolveAlias` | Full exports |
| `tyndale-next/server` | `TyndaleServerProvider`, `generateStaticLocaleParams`, `getDirection`, `isRtlLocale`, `resolveAlias` | Server-only; safe in RSC without importing `React.createContext` |
| `tyndale-next/config` | `withTyndaleConfig` | Used in `next.config.*` only |
| `tyndale-next/middleware` | `createTyndaleMiddleware` | Used in `middleware.ts` only |

## Related packages

| Package | Purpose |
|---|---|
| [`tyndale`](../tyndale) | CLI — `init`, `extract`, `translate`, `validate`, and more |
| [`tyndale-react`](../tyndale-react) | React runtime — `<T>`, `useTranslation()`, `Plural`, `Num`, and more |
