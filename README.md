<!-- prettier-ignore -->
<div align="center">

# Tyndale

[![npm version](https://img.shields.io/npm/v/tyndale?style=flat-square)](https://www.npmjs.com/package/tyndale)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Open-source AI-powered i18n for React & Next.js.**\
Write your app in one language. Run the CLI. Get translations.

[Quickstart](#quickstart) • [Packages](#packages) • [CLI](#cli-reference) • [React API](#react-api) • [Next.js](#nextjs-integration) • [Configuration](#configuration)

</div>

---

Tyndale extracts translatable content from your React components, sends it to the AI provider of your choice, and generates locale files your app loads at runtime. No key catalogs to manage, no manual JSON editing — wrap your JSX in `<T>` and let the CLI do the rest.

## Features

- **Zero-key workflow** — translate JSX and strings without maintaining key files
- **AI-powered** — uses your own AI provider (Anthropic, OpenAI, etc.) for high-quality translations
- **Incremental** — only translates what changed since the last run
- **Rich content** — handles variables, plurals, numbers, currency, and dates inside translations
- **Next.js first-class** — locale routing middleware, server/client providers, RTL support, and static generation helpers
- **CI-friendly** — `tyndale validate` checks translations without writing files

## Quickstart

### 1. Install

```bash
npm install tyndale tyndale-react tyndale-next
```

### 2. Initialize

```bash
npx tyndale init
```

This scaffolds `tyndale.config.json`, updates `.gitignore`, and generates middleware for Next.js.

### 3. Authenticate

```bash
npx tyndale auth
```

Stores your AI provider API key locally.

### 4. Wrap translatable content

```tsx
import { T, Var, useTranslation } from 'tyndale-react';

// JSX translation
<T>
  <h1>Welcome to our app</h1>
  <p>Start building something great.</p>
</T>

// Variables in JSX
<T>
  <p>Hello <Var name="user">{userName}</Var>, you have <Num value={count} /> items.</p>
</T>

// String translation (hook)
const t = useTranslation();
<input placeholder={t('Search products...')} />
```

### 5. Extract and translate

```bash
npx tyndale extract
npx tyndale translate
```

### 6. Add the provider to your Next.js layout

```tsx
// app/[locale]/layout.tsx
import { TyndaleServerProvider } from 'tyndale-next';

export default function LocaleLayout({ children, params }) {
  return (
    <TyndaleServerProvider locale={params.locale}>
      {children}
    </TyndaleServerProvider>
  );
}
```

> [!TIP]
> Both `extract` and `translate` are idempotent — if nothing changed, they finish instantly. Add them to your build script:
> ```json
> { "scripts": { "build": "tyndale extract && tyndale translate && next build" } }
> ```

## Packages

This is a monorepo containing three packages:

| Package | Description |
|---------|-------------|
| [`tyndale`](packages/tyndale) | CLI — extract, translate, translate-docs, validate, auth, model, init |
| [`tyndale-react`](packages/tyndale-react) | React components and hooks for rendering translations |
| [`tyndale-next`](packages/tyndale-next) | Next.js adapter — middleware, server provider, config helper |

## CLI Reference

| Command | Description |
|---------|-------------|
| `tyndale init` | Scaffold config, `.gitignore`, middleware |
| `tyndale auth` | Set up AI provider credentials |
| `tyndale extract` | Walk source files, produce manifest + default locale JSON |
| `tyndale translate` | Translate the delta for each target locale |
| `tyndale validate` | Check for errors without writing files (CI-ready) |
| `tyndale translate-docs` | Translate documentation files for any supported framework |
| `tyndale translate-docs setup` | Detect docs framework and save to config |
| `tyndale model` | Change the AI model for translations |

`tyndale translate-docs` writes `.tyndale-docs-state.json` at your project root to track source-document hashes. Commit this file so fresh clones can skip unchanged docs without retranslation.

### `tyndale translate` flags

| Flag | Description |
|------|-------------|
| `--locale es` | Translate a single locale |
| `--force` | Retranslate everything |
| `--batch-size 30` | Override batch size |
| `--dry-run` | Show delta without translating |

## React API

All components and hooks are exported from `tyndale-react`.

### Components

| Component | Purpose |
|-----------|---------|
| `<T>` | Wraps translatable JSX content |
| `<Var name="x">` | Dynamic text slot inside `<T>` |
| `<Num value={n} />` | Locale-formatted number |
| `<Currency value={n} currency="USD" />` | Locale-formatted currency |
| `<DateTime value={date} />` | Locale-formatted date/time |
| `<Plural one="item" other="items" value={n} />` | Pluralized text |

### Hooks and functions

| Export | Purpose |
|--------|---------|
| `useTranslation()` | Returns `t(source, vars?)` for string translation |
| `useLocale()` | Returns the current locale string |
| `useChangeLocale()` | Returns a function to switch locale at runtime |
| `useDictionary()` | Access key-value dictionary translations |
| `msg('text')` | Mark strings as translatable outside components |

## Next.js Integration

Exports from `tyndale-next`:

| Export | Purpose |
|--------|---------|
| `TyndaleServerProvider` | Server component — loads locale data from filesystem |
| `TyndaleNextClientProvider` | Client component — wraps provider with Next.js navigation |
| `withTyndaleConfig(nextConfig)` | Injects Tyndale env vars and resolve aliases into `next.config` |
| `tyndaleMiddleware` | Locale detection and routing middleware |
| `generateStaticLocaleParams()` | Generates locale params for static generation |
| `useDirection()` | Returns `'ltr'` or `'rtl'` for the current locale |
| `TyndaleCache` | Memoizes translated content in shared layouts |

### Next.js config setup

```js
// next.config.mjs
import { withTyndaleConfig } from 'tyndale-next/config';

export default withTyndaleConfig({
  // your existing Next.js config
});
```

### Middleware

```ts
// middleware.ts
export { tyndaleMiddleware as middleware } from 'tyndale-next/middleware';
```

## Configuration

Create `tyndale.config.json` at your project root (or run `tyndale init`):

```json
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "ja"],
  "source": ["src", "app"],
  "extensions": [".ts", ".tsx", ".js", ".jsx"],
  "output": "public/_tyndale",
  "batchSize": 50,
  "localeAliases": { "pt-BR": "pt" },
  "dictionaries": {
    "include": ["src/dictionaries/*.json"],
    "format": "key-value"
  },
  "pi": {
    "model": "claude-sonnet-4-20250514",
    "thinkingLevel": "low"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `defaultLocale` | `string` | Source language code |
| `locales` | `string[]` | Target locales |
| `source` | `string[]` | Directories to scan for translatable content |
| `extensions` | `string[]` | File extensions to include |
| `output` | `string` | Output directory for locale files |
| `batchSize` | `number` | Entries per AI translation batch |
| `localeAliases` | `object` | Map variant locale codes to canonical ones |
| `dictionaries` | `object` | Dictionary file discovery config |
| `pi` | `object` | AI model and thinking level |
| `docs` | `object` | Documentation framework config (`framework`, `contentDir`, `extensions`) |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Bun](https://bun.sh/) (for development)
- An AI provider API key (Anthropic, OpenAI, etc.)

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Type-check
bun run typecheck
```
