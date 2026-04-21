---
name: setup-tyndale
description: Use when adding Tyndale i18n to a React, Next.js, or Astro/Starlight project, integrating translations into an existing codebase, or a user says "add translations", "internationalize this app", "set up i18n", or "add multi-language support"
user-invocable: true
compatibility: Requires a React, Next.js, or Astro project
license: MIT
metadata:
  - author: "ogrodev"
  - version: "2.0"
---

# Setup Tyndale

## Overview

Tyndale is AI-powered i18n for React, Next.js, Astro applications, and documentation sites. You write your app in one language, run the CLI, and get translations. No key files to maintain.

This skill integrates Tyndale from the published npm packages. For a local clone, use `setup-tyndale-local`.

## Supported frameworks

**App translation (`npx tyndale extract` / `npx tyndale translate`)**

- React
- Vite + React
- Next.js
- Astro components (`.astro`)

**Documentation translation (`npx tyndale translate-docs`)**

- Starlight
- Docusaurus
- VitePress
- MkDocs
- Nextra

## When to Use

- Adding i18n to a React, Next.js, or Astro app
- Translating docs for Starlight, Docusaurus, VitePress, MkDocs, or Nextra
- "Internationalize", "translate", "add language support"
- Setting up Tyndale in a new or existing project

**Not for:** debugging translation output, modifying Tyndale internals, or working on the Tyndale monorepo.

## Prerequisites

- Node.js >= 20
- React, Vite+React, Next.js (>= 14, including 15/16), Astro, or a supported docs framework project
- AI provider API key (Anthropic, OpenAI, or Google)

## CLI quick reference

| Command                      | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `npx tyndale init`           | Scaffold config, detect framework                                    |
| `npx tyndale auth`           | Store AI provider credentials                                        |
| `npx tyndale model`          | Pick/update AI model                                                 |
| `npx tyndale translate`      | Auto-runs extract, then translates via AI                            |
| `npx tyndale translate-docs` | Translate Astro/Starlight/Docusaurus/VitePress/MkDocs/Nextra content |
| `npx tyndale validate`       | Check translations without writing (CI)                              |

Flags: `--locale <code>`, `--force`, `--dry-run`, `--token-budget <n>`, `--concurrency <n>`.

## Setup steps

### 1. Install packages

```bash
# Next.js
npm install tyndale-react tyndale-next
npm install -D tyndale

# React (Vite or plain)
npm install tyndale-react
npm install -D tyndale

# Astro app translation
npm install tyndale-react
npm install -D tyndale

# Astro / Starlight docs only
npm install -D tyndale
```

### 2. Initialize

Before running `init`, ask the user what locales they want to setup, for default locale, identify in the codebase. Use any provided tool from your harness to ask the question interactively, so you can run the command non-interactive way with the answers as flags.

```bash
npx tyndale init
# or non-interactive:
npx tyndale init --default-locale en --locales es,fr,ja
```

Generates `tyndale.config.json`, adds `public/_tyndale/` to `.gitignore`, and for Next.js creates `middleware.ts`.

### 3. Authenticate

First check if its already authenticated. If not, ask the user to run auth and to let you know so you can continue with the setup. This is a one-time step per machine to store their AI provider credentials.

```bash
npx tyndale auth
```

One-time per machine.

### 4. Next.js wiring

Skip for non-Next.js projects.

**a. Wrap `next.config.mjs`:**

```js
import { withTyndaleConfig } from "tyndale-next/config";

export default withTyndaleConfig({
  // your existing config
});
```

`withTyndaleConfig` reads `tyndale.config.json`, injects build-time env vars, and aliases `tyndale-react` so the provider context is shared.

**b. Verify `middleware.ts`** (created by `init`):

```ts
import { createTyndaleMiddleware } from "tyndale-next/middleware";

export default createTyndaleMiddleware();

export const config = {
  matcher: ["/((?!api|_next|_tyndale|.*\\..*).*)"],
};
```

**c. Use `[locale]` dynamic segment:**

```
app/
  [locale]/
    layout.tsx    ← TyndaleServerProvider here
    page.tsx
```

**d. Server provider in the root layout** (Next 15+ requires awaiting `params`):

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

Import from `tyndale-next/server` (canonical). In client components use `useDirection()` instead of `getDirection`.

### 5. Non-Next.js React wiring

```tsx
import { TyndaleProvider } from "tyndale-react";

<TyndaleProvider
  defaultLocale="en"
  locale="en"
  initialManifest={manifest}
  initialTranslations={translations}
>
  {/* your app */}
</TyndaleProvider>;
```

`TyndaleProvider` takes `defaultLocale`, optional `locale`, and optional preloaded `initialManifest` / `initialTranslations`. If you do not preload them, it fetches `manifest.json` and `<locale>.json` from `public/_tyndale/` automatically.

### 6. Astro applications

If you want to translate `.astro` pages/components, use the normal app translation flow — not `translate-docs`.

**a. Add Astro's React integration if your project does not already render React components:**

```bash
npx astro add react
```

`tyndale-react` exports React components such as `<T>`, `<Var>`, and `<Num>`, so Astro needs the React integration to render them. Official Astro docs: https://docs.astro.build/en/guides/integrations-guide/react/

**b. Keep `.astro` in `extensions`** (`init` adds it by default):

```json
{
  "extensions": [".ts", ".tsx", ".js", ".jsx", ".astro"]
}
```

**c. Wrap translatable Astro content:**

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

**d. Translate the app:**

```bash
npx tyndale translate
```

### 7. Astro / Starlight docs

Use `translate-docs` for docs content, not app UI strings.

Either add `docs` to `tyndale.config.json` manually:

```json
{
  "docs": {
    "framework": "starlight",
    "contentDir": "src/content/docs"
  }
}
```

Or let Tyndale detect and write it for you:

```bash
npx tyndale translate-docs setup
```

Supported frameworks: `starlight`, `docusaurus`, `vitepress`, `mkdocs`, `nextra`. Then run `npx tyndale translate-docs`.

For Astro component strings (not docs), keep using `translate`; `translate-docs` is only for docs content.

### 8. Wrap translatable content

```tsx
import { T, Var, Num, useTranslation } from "tyndale-react";

<T>
  <h1>Welcome to our app</h1>
  <p>
    Hello <Var name="user">{userName}</Var>, you have <Num value={count} />{" "}
    items.
  </p>
</T>;

function SearchBar() {
  const t = useTranslation();
  return <input placeholder={t("Search products...")} />;
}
```

**Components:** `<T>`, `<Var>`, `<Num>`, `<Currency>`, `<DateTime>`, `<Plural>`.
**Hooks:** `useTranslation`, `useLocale`, `useChangeLocale`, `useDictionary`, `useDirection` (tyndale-next).

### 9. Extract, translate, build

```bash
npx tyndale translate    # idempotent; auto-runs extract
```

Wire into build:

```json
{
  "scripts": {
    "build": "tyndale translate && next build"
  }
}
```

### 10. CI

```bash
npx tyndale validate
```

Exits non-zero on missing or stale translations without writing files.

## Configuration reference

`tyndale.config.json` at project root:

```json
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "ja"],
  "source": ["src", "app"],
  "extensions": [".ts", ".tsx", ".js", ".jsx", ".astro"],
  "output": "public/_tyndale",
  "translate": { "tokenBudget": 50000, "concurrency": 8 },
  "localeAliases": { "pt-BR": "pt" },
  "dictionaries": {
    "include": ["src/dictionaries/*.json"],
    "format": "key-value"
  },
  "pi": { "model": "claude-sonnet-4-20250514", "thinkingLevel": "low" },
  "docs": { "framework": "starlight", "contentDir": "src/content/docs" }
}
```

| Field                   | Type       | Default                                | Notes                                                           |
| ----------------------- | ---------- | -------------------------------------- | --------------------------------------------------------------- |
| `defaultLocale`         | `string`   | `"en"`                                 | Source language. **Must not** appear in `locales`.              |
| `locales`               | `string[]` | required                               | Target locales only.                                            |
| `source`                | `string[]` | `["src"]`                              | Directories scanned by `extract`.                               |
| `include` / `exclude`   | `string[]` | —                                      | Glob overrides for the file walker.                             |
| `extensions`            | `string[]` | `[".ts",".tsx",".js",".jsx",".astro"]` |                                                                 |
| `output`                | `string`   | `"public/_tyndale"`                    | Output directory.                                               |
| `translate.tokenBudget` | `number`   | `50000`                                | Tokens per batch.                                               |
| `translate.concurrency` | `number`   | auto                                   | Parallel AI sessions.                                           |
| `localeAliases`         | `object`   | `{}`                                   | e.g. `{"pt-BR":"pt"}`.                                          |
| `dictionaries.include`  | `string[]` | `[]`                                   | Glob patterns.                                                  |
| `dictionaries.format`   | `string`   | `"key-value"`                          |                                                                 |
| `pi.model`              | `string`   | `"claude-sonnet-4-20250514"`           | Anthropic / OpenAI / Google IDs.                                |
| `pi.thinkingLevel`      | `string`   | `"low"`                                |                                                                 |
| `docs.framework`        | enum       | —                                      | `starlight` / `docusaurus` / `vitepress` / `mkdocs` / `nextra`. |
| `docs.contentDir`       | `string`   | auto                                   |                                                                 |

There is no `batchSize` field. If you see one in an older config, migrate to `translate.tokenBudget`.

## Common mistakes

| Mistake                                               | Fix                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `params: { locale: string }` in Next 15/16 layout     | Use `params: Promise<{ locale: string }>` + `const { locale } = await params` |
| `defaultLocale` listed in `locales`                   | `locales` is targets only — remove the default                                |
| Importing `TyndaleServerProvider` from `tyndale-next` | Import from `tyndale-next/server` (gives you `getDirection` too)              |
| Missing `withTyndaleConfig()` in Next.js              | Tyndale needs build-time env vars — wrap the config                           |
| Missing `[locale]` route segment                      | Next.js locale routing requires `app/[locale]/`                               |
| Setting `batchSize` in config                         | Obsolete — use `translate.tokenBudget`                                        |
| Running `extract` manually before `translate`         | Not required; `translate` runs extract                                        |
| Not adding `public/_tyndale/` to `.gitignore`         | `init` does it; verify after                                                  |
| Wrapping non-translatable content in `<T>`            | Only wrap user-facing text, not dynamic data                                  |

Switch with `npx tyndale model` or by editing `pi.model`.
