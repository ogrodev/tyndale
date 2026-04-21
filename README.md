<!-- prettier-ignore -->
<div align="center">
  <img src="./apps/website/public/favicon.svg" alt="Tyndale logo" width="72" height="72" />

# Tyndale

[![Build Status](https://img.shields.io/github/actions/workflow/status/ogrodev/tyndale/ci.yml?style=flat-square&label=CI)](https://github.com/ogrodev/tyndale/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/tyndale?style=flat-square)](https://www.npmjs.com/package/tyndale)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**AI-powered i18n for React, Next.js, and Astro.**  
Write your app in one language, run the CLI, and generate translated UI and docs.

[Overview](#overview) • [Supported frameworks](#supported-frameworks) • [Quickstart](#quickstart) • [Translate docs](#translate-documentation) • [Packages](#packages) • [Configuration](#configuration) • [Development](#development)

</div>

## Overview

Tyndale is a Bun monorepo with three publishable packages:

- `tyndale` — CLI for extracting, translating, validating, and initializing projects
- `tyndale-react` — React components and hooks for runtime translation
- `tyndale-next` — Next.js adapter for locale routing, providers, and static generation helpers

It is built for a zero-key workflow: wrap JSX or `.astro` templates with `<T>`, mark plain strings with `msg()` or `useTranslation()`, then let the CLI generate locale files for your app. Tyndale can also translate MDX/Markdown documentation with `translate-docs`.

## Supported frameworks

### App translation (`tyndale extract` / `tyndale translate`)

- React
- Vite + React
- Next.js
- Astro components (`.astro`)

### Documentation translation (`tyndale translate-docs`)

- Starlight
- Docusaurus
- VitePress
- MkDocs
- Nextra

## Features

- Zero-key JSX and `.astro` string extraction for app translation
- AI-powered translation using your configured provider
- Incremental app translation based on deltas
- Rich formatting support for variables, plurals, numbers, currency, and dates
- First-class Next.js support with middleware and server providers
- Docs translation for Starlight, Docusaurus, VitePress, MkDocs, and Nextra
- CI-friendly validation with `tyndale validate`

## Quickstart

### Let your AI set it up

Paste this prompt into your coding agent if you want it to handle the Tyndale integration for you:

```text
Read https://raw.githubusercontent.com/ogrodev/tyndale/main/skills/setup-tyndale/SKILL.md and use it to set up Tyndale in this project. Detect whether this codebase is React, Next.js, Astro, or a supported docs framework, install the right published packages, wire the framework correctly, and run the necessary Tyndale setup steps so I do not need to make the integration choices myself.
```

If you prefer to do it manually, follow the steps below.

### 1. Install

```bash
npm install tyndale-react
npm install -D tyndale
```

If you are using Next.js, also install the adapter:

```bash
npm install tyndale-next
```

### 2. Initialize your project

```bash
npx tyndale init
```

This creates `tyndale.config.json`, updates `.gitignore`, and scaffolds middleware for Next.js projects when needed.

### 3. Authenticate with your AI provider

```bash
npx tyndale auth
```

### 4. Mark translatable UI

```tsx
import { T, useTranslation, Var, Num } from "tyndale-react";

export function Welcome({
  userName,
  count,
}: {
  userName: string;
  count: number;
}) {
  const t = useTranslation();

  return (
    <div>
      <T>
        <h1>
          Hello <Var name="user">{userName}</Var>
        </h1>
        <p>
          You have <Num value={count} /> items.
        </p>
      </T>

      <input placeholder={t("Search products...")} />
    </div>
  );
}
```

### 5. Generate translations

```bash
npx tyndale translate
```

> [!TIP]
> `translate` auto-runs extraction first, then translates only changed strings. Run `npx tyndale extract` by itself when you want to inspect the extracted manifest before making translation calls.

### 6. Astro applications

If you want to translate `.astro` pages/components, Tyndale supports that too.

1. If your Astro project does not already render React components, add Astro's React integration first.

   ```bash
   npx astro add react
   ```

   `tyndale-react` exports React components such as `<T>`, `<Var>`, and `<Num>`, so Astro needs the React integration to render them. See Astro's official `@astrojs/react` guide: https://docs.astro.build/en/guides/integrations-guide/react/

2. Initialize Tyndale and keep `.astro` in `extensions` (added by `tyndale init` by default).

   ```json
   {
     "extensions": [".ts", ".tsx", ".js", ".jsx", ".astro"]
   }
   ```

3. Wrap translatable Astro content.

   ```astro
   ---
   import { T, Var, Num } from 'tyndale-react';
   const userName = 'Ada';
   const count = 3;
   ---

   <T>
     <h1>Hello <Var name="user">{userName}</Var></h1>
     <p>You have <Num name="count" value={count} /> items.</p>
   </T>
   ```

4. Run translations as usual.

   ```bash
   npx tyndale translate
   ```

### 7. For Next.js, verify the middleware

```ts
// middleware.ts
import { createTyndaleMiddleware } from "tyndale-next/middleware";

export default createTyndaleMiddleware();

export const config = {
  matcher: ["/((?!api|_next|_tyndale|.*\\..*).*)"],
};
```

### 8. Add the Next.js provider

```tsx
// app/[locale]/layout.tsx
import { getDirection, TyndaleServerProvider } from "tyndale-next/server";

export default async function RootLayout({
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

## Translate documentation

Tyndale does not stop at app strings. `translate-docs` translates MDX and Markdown documentation, detects supported docs frameworks, preserves imports and code fences, and retries invalid outputs when validation fails.

```bash
npx tyndale translate-docs setup
npx tyndale translate-docs
```

Supported frameworks: Starlight, Docusaurus, VitePress, MkDocs, Nextra.

`translate-docs` writes `.tyndale-docs-state.json` at the project root to track source document hashes. Commit it so fresh clones can skip unchanged docs instead of retranslating everything.

## Packages

| Package                                     | Purpose                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`tyndale`](./packages/tyndale)             | CLI for `init`, `auth`, `extract`, `translate`, `translate-docs`, `validate`, and `model`                   |
| [`tyndale-react`](./packages/tyndale-react) | Runtime components and hooks such as `<T>`, `useTranslation()`, `msg()`, and `useDictionary(filenameKey)`   |
| [`tyndale-next`](./packages/tyndale-next)   | Next.js helpers including middleware, config integration, server/client providers, and static locale params |
| [`apps/website`](./apps/website)            | Astro + Starlight documentation site for the project                                                        |

## CLI overview

| Command                        | Description                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `tyndale init`                 | Create `tyndale.config.json`, update `.gitignore`, and scaffold Next.js middleware when applicable |
| `tyndale auth`                 | Configure AI provider credentials                                                                  |
| `tyndale extract`              | Extract translatable source strings without translating them; useful for inspection and review     |
| `tyndale translate`            | Auto-extract, then translate changed app strings for configured locales                            |
| `tyndale translate-docs`       | Translate MDX/Markdown docs for a supported documentation framework                                |
| `tyndale translate-docs setup` | Detect a docs framework and write the `docs` config                                                |
| `tyndale validate`             | Validate locale files without making AI calls                                                      |
| `tyndale model`                | Change the configured AI model                                                                     |

## Configuration

`tyndale init` creates a starter config. A typical setup looks like this:

```json
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "ja"],
  "source": ["src", "app"],
  "extensions": [".ts", ".tsx", ".js", ".jsx", ".astro"],
  "output": "public/_tyndale",
  "translate": {
    "tokenBudget": 50000,
    "concurrency": 8
  },
  "localeAliases": {
    "pt-BR": "pt"
  },
  "dictionaries": {
    "include": ["src/dictionaries/*.json"],
    "format": "key-value"
  },
  "pi": {
    "model": "claude-sonnet-4-20250514",
    "thinkingLevel": "low"
  },
  "docs": {
    "framework": "starlight",
    "contentDir": "src/content/docs"
  }
}
```

> [!IMPORTANT]
> `defaultLocale` must not appear in `locales`. `defaultLocale` is the source language; `locales` contains only target locales.

Key fields:

- `translate.tokenBudget` — token budget per translation batch
- `translate.concurrency` — max parallel translation sessions
- `localeAliases` — map variant locale codes to canonical ones
- `dictionaries` — include key-value translation files alongside JSX translations
- `docs` — configure docs framework detection and content directory

## Development

This repository uses Bun workspaces.

```bash
# install dependencies
bun install

# run all tests
bun test

# type-check the workspace
bun run typecheck

# build publishable packages
bun run build:packages

# run the documentation site locally
bun --cwd apps/website dev
```

CI runs the same core checks on pushes and pull requests.
