---
name: setup-tyndale-local
description: Use when integrating Tyndale i18n from a locally cloned monorepo (development, testing unreleased features, contributing) instead of published npm packages, or when a user says "use local tyndale", "from source", or "from my clone"
user-invocable: true
compatibility: Requires a React/Next.js/Astro project and a local clone of the Tyndale monorepo
license: MIT
metadata:
  - author: "ogrodev"
  - version: "2.0"
---

# Setup Tyndale (Local Repo)

## Overview

Same integration as `setup-tyndale`, but links Tyndale packages from a local clone of the monorepo (default: `~/projects/tyndale`) instead of npm. Use for testing unreleased changes or contributing back.

This skill covers only the local-linking differences. For framework wiring (Next.js middleware, `[locale]` routing, Astro app translation, Astro/Starlight docs), use `setup-tyndale` — the steps are identical once packages resolve.

## Supported frameworks

**App translation**
- React
- Vite + React
- Next.js
- Astro components (`.astro`)

**Documentation translation**
- Starlight
- Docusaurus
- VitePress
- MkDocs
- Nextra

## When to Use

- Integrating Tyndale from a local checkout (not npm)
- Developing against unreleased Tyndale changes
- Testing contributions in a real consumer project

**Not for:** npm installs (use `setup-tyndale`), debugging Tyndale internals, or working inside the monorepo itself.

## Prerequisites

- Node.js >= 20
- React / Next.js (>= 14) / Astro / supported docs framework project
- Local clone of the Tyndale monorepo (default path: `~/projects/tyndale`)
- Bun 1.1+ **or** npm 10+ (monorepo is Bun-first)
- AI provider API key

## Setup steps

### 1. Build the local monorepo

The consumer project imports the built package output, so build first:

```bash
cd ~/projects/tyndale
bun install && bun run build:packages
# or: npm install && npm run build:packages
```

Rebuild after any source change to Tyndale.

### 2. Link packages via `file:` protocol

```bash
# Next.js
npm install \
  ~/projects/tyndale/packages/tyndale-react \
  ~/projects/tyndale/packages/tyndale-next
npm install -D ~/projects/tyndale/packages/tyndale

# React (Vite or plain)
npm install ~/projects/tyndale/packages/tyndale-react
npm install -D ~/projects/tyndale/packages/tyndale

# Astro app translation
npm install ~/projects/tyndale/packages/tyndale-react
npm install -D ~/projects/tyndale/packages/tyndale

# Astro / Starlight docs only
npm install -D ~/projects/tyndale/packages/tyndale
```

This writes `file:` refs to `package.json`:

```json
{
  "dependencies": {
    "tyndale-react": "file:../tyndale/packages/tyndale-react",
    "tyndale-next": "file:../tyndale/packages/tyndale-next"
  },
  "devDependencies": {
    "tyndale": "file:../tyndale/packages/tyndale"
  }
}
```

**Bun alternative:** in a Bun workspace consumer, use `"tyndale-react": "workspace:*"` and `"tyndale-next": "workspace:*"` in `dependencies` as needed, and `"tyndale": "workspace:*"` in `devDependencies` (if the consumer is inside the same workspace), or use `bun link`.

### 3. Framework wiring

From here on, follow `setup-tyndale` steps 2–10:
- `npx tyndale init`
- `npx tyndale auth`
- Next.js: `withTyndaleConfig`, `middleware.ts`, `app/[locale]/layout.tsx` with **`params: Promise<{ locale: string }>` + `await params`**, `TyndaleServerProvider` from `tyndale-next/server`
- React: wrap in `<TyndaleProvider defaultLocale="en" initialManifest={manifest} initialTranslations={translations}>…</TyndaleProvider>` or let it fetch from `public/_tyndale/` automatically
- Astro apps: add Astro's React integration if needed, keep `.astro` in `extensions`, wrap `.astro` content with `<T>` / `<Var>` / `<Num>`, then run `npx tyndale translate`
- Astro / Starlight docs: add `docs` config or run `npx tyndale translate-docs setup`, then use `npx tyndale translate-docs`
- Wrap content in `<T>` / `<Var>` / `<Num>` etc.
- `npx tyndale translate` (auto-runs extract)

## Keeping local packages in sync

After editing Tyndale source:

```bash
# In the monorepo
cd ~/projects/tyndale && bun run build:packages   # or npm run build:packages

# In the consumer project
npm install                                      # re-link file: deps
```

If `file:` symlinks break after a `node_modules` wipe, re-run the install command from step 2.

## Common mistakes

| Mistake | Fix |
| --- | --- |
| Installing without building the monorepo | Packages consume built output; run `bun run build:packages` first |
| Stale behavior after Tyndale source changes | Rebuild with `bun run build:packages`, then `npm install` in the consumer |
| `params: { locale: string }` in Next 15/16 | Use `params: Promise<{ locale: string }>` + `await params` |
| Importing `TyndaleServerProvider` from `tyndale-next` | Canonical path is `tyndale-next/server` |
| `batchSize` in config | Obsolete — use `translate.tokenBudget` |
| `defaultLocale` listed in `locales` | `locales` is targets only |
| Forgetting `withTyndaleConfig()` in Next.js | Tyndale needs build-time env vars injected |
| Missing `[locale]` segment | Next.js locale routing requires `app/[locale]/` |

## Reference

All config fields, CLI commands, flags, components, hooks, and supported AI providers match `setup-tyndale`. See that skill for the complete reference.
