<!-- prettier-ignore -->
<div align="center">
  <img src="./apps/website/public/favicon.svg" alt="Tyndale logo" width="72" height="72" />

# Tyndale

[![Build Status](https://img.shields.io/github/actions/workflow/status/ogrodev/tyndale/ci.yml?style=flat-square&label=CI)](https://github.com/ogrodev/tyndale/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/tyndale?style=flat-square)](https://www.npmjs.com/package/tyndale)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Translate your app with the AI subscription you already pay for.**  
Tyndale wraps your strings, hashes them, and only sends what changed to your model.

Website: https://tyndale.dev

[Website](https://tyndale.dev) • [Why Tyndale](#why-tyndale) • [Quickstart](#quickstart) • [Supported frameworks](#supported-frameworks) • [Translate docs](#translate-documentation) • [Packages](#packages) • [Configuration](#configuration) • [Development](#development)

</div>

## Why Tyndale

If you already pay for Claude, ChatGPT, or another AI assistant, you have everything you need to translate your app. Tyndale runs on top of that subscription. There is no separate translation API to sign up for, no per-word billing, no extra invoice at the end of the month.

The piece most i18n setups get wrong is how they handle change. Every time you tweak a string, the naive workflow is to ask an agent to re-read your locale files, compare them to source, and figure out what to update. That burns thousands of tokens on work the tool should already know how to do.

Tyndale fingerprints every translatable string with a content hash. When you run `translate`, it compares hashes against the manifest, sends only the new and changed entries to the model, and removes stale ones. Unchanged strings cost zero tokens. The same hashing applies to MDX and Markdown docs, with state stored in `.tyndale-docs-state.json` so a fresh clone skips work that was already done.

The setup is meant to be boring. Drop a prompt into your coding agent, let it pick the right packages and wire the framework, then start marking strings.

## Quickstart

### Let your agent do the integration

Paste this into Claude Code, Cursor, or whichever agent you use:

```text
Read https://raw.githubusercontent.com/ogrodev/tyndale/main/skills/setup-tyndale/SKILL.md and use it to set up Tyndale in this project. Detect whether this codebase is React, Next.js, Astro, or a supported docs framework, install the right published packages, wire the framework correctly, and run the necessary Tyndale setup steps so I do not need to make the integration choices myself.
```

If you'd rather do it by hand, the steps below cover the same ground.

### 1. Install

```bash
npm install tyndale-react
npm install -D tyndale
```

For Next.js, also install the adapter:

```bash
npm install tyndale-next
```

### 2. Initialize your project

```bash
npx tyndale init
```

This writes `tyndale.config.json`, updates `.gitignore`, and scaffolds Next.js middleware when needed.

### 3. Sign in to your AI provider

```bash
npx tyndale auth
```

OAuth providers open a browser and reuse your existing subscription. Providers without OAuth fall back to an API key. Either way, the credentials live on your machine.
[Supported Providers](https://github.com/badlogic/pi-mono/tree/main/packages/ai#supported-providers)

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
> `translate` extracts first, then sends only the changed hashes to your model. Run `npx tyndale extract` on its own if you want to inspect the manifest before any translation calls happen.

### 6. Astro applications

If your `.astro` files need translating, Tyndale handles them too.

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

## Supported frameworks

App translation (`tyndale extract` / `tyndale translate`):

- React
- Vite + React
- Next.js
- Astro components (`.astro`)

Documentation translation (`tyndale translate-docs`):

- Starlight
- Docusaurus
- VitePress
- MkDocs
- Nextra

## Translate documentation

`translate-docs` works on MDX and Markdown the same way `translate` works on UI strings. It detects the docs framework, preserves imports and code fences, retries when validation rejects an output, and tracks source hashes in `.tyndale-docs-state.json` so unchanged pages stay free.

```bash
npx tyndale translate-docs setup
npx tyndale translate-docs
```

Commit `.tyndale-docs-state.json` so collaborators and CI inherit the same state and don't retranslate pages that nobody touched.

## Features

- Zero-key JSX and `.astro` extraction
- OAuth login that reuses the AI subscription you already have
- Content-hashed deltas so unchanged strings cost zero tokens
- Variables, plurals, numbers, currency, and dates handled by the runtime
- First-class Next.js support with middleware and server providers
- Docs translation for Starlight, Docusaurus, VitePress, MkDocs, and Nextra
- CI-friendly checking with `tyndale validate`

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
| `tyndale auth`                 | Sign in to your AI provider (OAuth or API key)                                                     |
| `tyndale extract`              | Extract translatable source strings without translating them                                       |
| `tyndale translate`            | Auto-extract, then translate only the changed hashes                                               |
| `tyndale translate-docs`       | Translate MDX/Markdown docs for a supported documentation framework                                |
| `tyndale translate-docs setup` | Detect a docs framework and write the `docs` config                                                |
| `tyndale validate`             | Validate locale files without making AI calls                                                      |
| `tyndale model`                | Change the configured AI model                                                                     |

## Configuration

`tyndale init` writes a starter config. A typical setup looks like this:

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
