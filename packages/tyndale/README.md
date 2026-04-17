<!-- prettier-ignore -->
<div align="center">
  <img src="../../apps/website/public/favicon.svg" alt="Tyndale logo" width="72" height="72" />

# tyndale

[![Build Status](https://img.shields.io/github/actions/workflow/status/ogrodev/tyndale/ci.yml?style=flat-square&label=CI)](https://github.com/ogrodev/tyndale/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/tyndale?style=flat-square)](https://www.npmjs.com/package/tyndale)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](../../LICENSE)

**CLI for AI-powered i18n — extract, translate, and validate.**

[Installation](#installation) • [Commands](#commands) • [Configuration](#configuration) • [Related packages](#related-packages)

</div>

The `tyndale` CLI drives the full internationalization lifecycle for React and Next.js projects. It scans your source code for translatable strings, calls your configured AI provider to generate translations, validates locale files, and translates documentation — all incrementally, so unchanged content is never retranslated.

## Installation

```bash
npm install -D tyndale
```

Or run without installing via `npx`:

```bash
npx tyndale --help
```

## Commands

```
tyndale <command> [options]
```

| Command | Description |
| --- | --- |
| [`init`](#init) | Scaffold `tyndale.config.json` and update `.gitignore` |
| [`auth`](#auth) | Configure AI provider credentials |
| [`extract`](#extract) | Extract translatable strings without running AI |
| [`translate`](#translate) | Extract, then translate changed strings with AI |
| [`translate-docs`](#translate-docs) | Translate MDX/Markdown documentation files |
| [`validate`](#validate) | Dry-run extraction and report errors without writing files |
| [`model`](#model) | Change the configured AI model |

---

### `init`

```bash
tyndale init [--default-locale <code>] [--locales <code,code,...>]
```

Creates `tyndale.config.json` in the current directory, adds generated files to `.gitignore`, and — for Next.js projects — scaffolds a `middleware.ts` file. Detects whether the project uses Next.js, Vite+React, or plain React to set sensible defaults.

> [!NOTE]
> `init` refuses to run if `tyndale.config.json` already exists. Delete it first if you need to reinitialize.

---

### `auth`

```bash
tyndale auth                        # interactive provider setup
tyndale auth --provider <id>        # skip TUI, go straight to a named provider
tyndale auth status                 # list configured providers and their status
tyndale auth logout                 # remove credentials for a provider
```

Opens an interactive TUI to select an AI provider. OAuth providers open a browser for login; API-key providers prompt for the key. Credentials are stored locally and never written to config files.

---

### `extract`

```bash
tyndale extract
```

Walks source files, parses `<T>` components, `msg()` calls, and `useTranslation()` hooks, then writes an extraction manifest to the output directory (`public/_tyndale` by default). Does not call any AI provider.

Use this when you want to inspect or review the extraction result before committing to translation.

---

### `translate`

```bash
tyndale translate [options]
```

Runs extraction automatically, computes a delta against the existing locale files, and translates only new or changed strings. Before the first batch, the CLI generates a **translation brief** — a per-locale style guide derived from a sample of your strings — and uses it to ensure consistent tone and terminology across all batches.

**Options:**

| Flag | Description |
| --- | --- |
| `--locale <code>` | Translate a single locale instead of all configured locales |
| `--force` | Retranslate all entries, ignoring the existing delta |
| `--dry-run` | Report new and stale entries without making AI calls |
| `--token-budget <n>` | Token budget per AI batch (default: `50000`) |
| `--concurrency <n>` | Max parallel translation sessions (auto-detected) |

> [!TIP]
> `--dry-run` is a good first step in CI to verify that locale files are up to date without spending tokens.

---

### `translate-docs`

```bash
tyndale translate-docs setup        # detect docs framework, write to config
tyndale translate-docs [options]    # translate documentation files
```

Translates MDX and Markdown documentation files for supported frameworks. The `setup` subcommand detects the docs framework in the current project and saves the result to `tyndale.config.json`.

**Supported frameworks:**

- Starlight
- Docusaurus
- VitePress
- MkDocs
- Nextra

**Options:**

| Flag | Description |
| --- | --- |
| `--content-dir <path>` | Override the docs content directory from config |
| `--force` | Retranslate all files, not only those that changed |
| `--concurrency <n>` | Max parallel translation sessions |

> [!NOTE]
> `translate-docs` writes `.tyndale-docs-state.json` at the project root to track source document hashes. Commit this file so fresh clones can skip unchanged documents and avoid unnecessary retranslation.

---

### `validate`

```bash
tyndale validate
```

Runs the full extraction pipeline and reports errors (unknown components, stale hashes, validation failures) without writing any output files and without calling any AI provider. Exits with a non-zero code on errors, making it suitable for CI checks.

---

### `model`

```bash
tyndale model
```

Opens an interactive TUI to select an AI model from the authenticated providers. The selected model is saved to the `pi.model` field in `tyndale.config.json`.

## Configuration

`tyndale init` creates a starter config. All fields:

```json
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "ja"],
  "source": ["src", "app"],
  "extensions": [".ts", ".tsx", ".js", ".jsx"],
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
> `defaultLocale` must **not** appear in `locales`. `defaultLocale` is the source language; `locales` contains only target locales.

| Field | Description |
| --- | --- |
| `defaultLocale` | Source language code (e.g. `"en"`) |
| `locales` | Array of target locale codes to translate into |
| `source` | Source directories to scan (default: `["src"]`) |
| `extensions` | File extensions to scan (default: `.ts .tsx .js .jsx`) |
| `output` | Directory where extracted manifests are written |
| `translate.tokenBudget` | Token budget per AI batch |
| `translate.concurrency` | Max parallel AI sessions |
| `localeAliases` | Map variant codes to canonical ones (e.g. `"pt-BR" → "pt"`) |
| `dictionaries.include` | Glob patterns for key-value JSON translation files |
| `pi.model` | AI model identifier (set interactively via `tyndale model`) |
| `pi.thinkingLevel` | Reasoning depth: `"low"`, `"medium"`, or `"high"` |
| `docs.framework` | Docs framework id: `starlight`, `docusaurus`, `vitepress`, `mkdocs`, `nextra` |
| `docs.contentDir` | Path to the source (default-locale) docs content directory |

## Related packages

| Package | Purpose |
| --- | --- |
| [`tyndale-react`](../tyndale-react) | React components and hooks: `<T>`, `useTranslation()`, `msg()`, `useDictionary()` |
| [`tyndale-next`](../tyndale-next) | Next.js adapter: middleware, server/client providers, static locale params |
