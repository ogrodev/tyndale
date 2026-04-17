<!-- prettier-ignore -->
<div align="center">
  <img src="https://raw.githubusercontent.com/ogrodev/tyndale/main/apps/website/public/favicon.svg" alt="Tyndale logo" width="64" height="64" />

# tyndale-react

[![npm version](https://img.shields.io/npm/v/tyndale-react?style=flat-square)](https://www.npmjs.com/package/tyndale-react)
[![Build Status](https://img.shields.io/github/actions/workflow/status/ogrodev/tyndale/ci.yml?style=flat-square&label=CI)](https://github.com/ogrodev/tyndale/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](../../LICENSE)

React runtime for [Tyndale](https://github.com/ogrodev/tyndale) — components and hooks that render translations in your React app with no configuration overhead.

</div>

## Overview

`tyndale-react` is the client-side half of Tyndale's i18n system. It provides the `<T>` component for translating JSX, hooks for translating plain strings, and locale-aware formatting components for numbers, currencies, and dates.

The CLI (`tyndale`) extracts source strings from these components, sends them to an AI for translation, and writes locale JSON files that this runtime loads at startup.

> [!NOTE]
> If you are using Next.js, also install [`tyndale-next`](../tyndale-next) for locale routing, middleware, and server-side rendering support.

## Installation

```bash
npm install tyndale-react
# or
bun add tyndale-react
```

**Peer dependency:** React 18 or 19.

## Quickstart

### 1. Wrap your app in `TyndaleProvider`

```tsx
import { TyndaleProvider } from 'tyndale-react';

export function App() {
  return (
    <TyndaleProvider defaultLocale="en" locale="es">
      <YourApp />
    </TyndaleProvider>
  );
}
```

The provider fetches `/_tyndale/{locale}.json` and `/_tyndale/manifest.json` automatically. While loading, it renders children as-is using the source content — no flash, no empty state.

### 2. Mark translatable JSX with `<T>`

```tsx
import { T, Var, Num } from 'tyndale-react';

export function Welcome({ name, count }: { name: string; count: number }) {
  return (
    <T>
      <h1>Hello, <Var name="user">{name}</Var>!</h1>
      <p>You have <Num value={count} /> unread messages.</p>
    </T>
  );
}
```

The CLI extractor recognizes `<T>` blocks and sends their content for translation. At runtime, `<T>` hashes the serialized content, looks up the translation, and re-renders it with the original React elements and variable bindings restored.

### 3. Translate plain strings with `useTranslation()`

```tsx
import { useTranslation } from 'tyndale-react';

export function SearchBar() {
  const t = useTranslation();

  return <input placeholder={t('Search products...')} />;
}
```

Supports `{name}` interpolation:

```tsx
const message = t('Welcome back, {name}!', { name: user.displayName });
```

### 4. Generate translations

```bash
npx tyndale translate
```

This extracts all `<T>` blocks and `useTranslation()` calls, sends changed strings to the AI, and writes locale files to `public/_tyndale/`.

## Components

### `<T>`

Wraps translatable JSX. The CLI extracts the serialized content; the runtime looks up the translation by content hash and re-renders it.

```tsx
<T>
  <p>This entire paragraph is translatable.</p>
</T>
```

Falls back to source children when no translation is found or when the provider is not mounted.

---

### `<Var name="...">`

A named dynamic slot inside `<T>`. The CLI preserves it as a `{name}` placeholder in the translation string, and the runtime substitutes the original element back at render time.

```tsx
<T>
  <p>Hello, <Var name="user">{userName}</Var>!</p>
</T>
```

---

### `<Num>`

Locale-aware number formatter. Wraps `Intl.NumberFormat`.

```tsx
<Num value={1234567} />
// → "1,234,567" (en) / "1.234.567" (de)

<Num value={0.42} options={{ style: 'percent' }} />
// → "42%"
```

Inside `<T>`, serialized as a named placeholder; outside `<T>`, renders the formatted number directly.

---

### `<Currency>`

Locale-aware currency formatter.

```tsx
<Currency value={29.99} currency="USD" />
// → "$29.99" (en-US) / "29,99 $" (fr-FR)
```

---

### `<DateTime>`

Locale-aware date/time formatter. Accepts a `Date`, Unix timestamp, or ISO string.

```tsx
<DateTime value={new Date()} options={{ dateStyle: 'long' }} />
// → "April 16, 2026" (en) / "16 avril 2026" (fr)
```

---

### `<Plural>`

CLDR-based plural selection. Supports all six plural categories (`zero`, `one`, `two`, `few`, `many`, `other`).

```tsx
<Plural count={itemCount} one="{count} item" other="{count} items" />
```

`{count}` in each branch is interpolated with the actual count. Inside `<T>`, serialized to ICU plural format.

## Hooks and functions

### `useTranslation()`

Returns a `t(source, vars?)` function for translating plain strings.

```tsx
const t = useTranslation();
const label = t('Save changes');
const greeting = t('Hello, {name}!', { name: 'Alice' });
```

Hashes the source string, looks up the translation, applies interpolation, and falls back to the source when no translation exists.

---

### `useLocale()`

Returns the current locale string.

```tsx
const locale = useLocale(); // "es"
```

---

### `useChangeLocale()`

Returns a function that fetches a new locale and updates the provider. Uses last-write-wins semantics: concurrent calls abort in-flight fetches.

```tsx
const changeLocale = useChangeLocale();
<button onClick={() => changeLocale('fr')}>Français</button>
```

---

### `useDictionary(filenameKey)`

Resolves dictionary entries for a given filename key. Dictionaries are JSON key-value files translated by the CLI alongside JSX strings.

```tsx
// Assuming src/dictionaries/nav.json was translated
const nav = useDictionary('nav');
// → { "home": "Inicio", "about": "Acerca de" }
```

---

### `msg(source)`

Marks a translatable string defined outside a component's render function. Returns a React element that resolves to the translated string at render time inside a `TyndaleProvider`.

```tsx
const NAV_ITEMS = [
  { label: msg('Home'), href: '/' },
  { label: msg('About'), href: '/about' },
];

// In JSX:
<a href={item.href}>{item.label}</a>
```

The CLI extractor recognizes `msg('literal')` calls and extracts the argument.

---

### `msgString(source)`

Like `msg()`, but for non-React contexts (Astro, Node.js) where a plain string is needed. Returns the source string unchanged at runtime; the CLI extractor still picks it up.

```ts
import { msgString } from 'tyndale-react';
const title = msgString('Page title');
```

---

### `getTranslation(options)` — server entry (`tyndale-react/server`)

Async server-side translation function. Loads locale files from disk and returns a `t()` function.

```ts
import { getTranslation } from 'tyndale-react/server';

const t = await getTranslation({
  locale: 'fr',
  defaultLocale: 'en',
  outputPath: './public/_tyndale',
});

const title = t('Welcome');
```

> [!NOTE]
> For Next.js server components, use `TyndaleServerProvider` from [`tyndale-next`](../tyndale-next) instead — it handles file loading and passes translations through React context automatically.

## `TyndaleProvider` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultLocale` | `string` | — | Source locale the app is written in |
| `locale` | `string` | `defaultLocale` | Active locale to display |
| `basePath` | `string` | `'/_tyndale'` | Base URL for locale JSON files |
| `initialTranslations` | `Record<string, string>` | — | Pre-loaded translations (skips fetch; use for SSR or testing) |
| `initialManifest` | `Manifest \| null` | — | Pre-loaded manifest |
| `onLocaleChange` | `(locale: string) => void` | — | Called when locale changes (controlled mode) |

## How it works

Tyndale uses a content-addressed translation store. When you write:

```tsx
<T><p>Hello, <Var name="user">{name}</Var>!</p></T>
```

The CLI serializes the JSX structure into a wire format string and computes its SHA-256 hash. The translated string is stored at that hash in the locale JSON file. At runtime, `<T>` performs the same serialization and hash, looks up the translated wire format, then deserializes it back into React elements — restoring `<Var>`, `<Num>`, and other components with their original props.

This means:
- No string IDs to manage — the source content is the key.
- Structural changes (adding a word, wrapping in a tag) produce a new hash and trigger re-translation automatically.
- Translations are lazy: only the active locale file is loaded.

## Related packages

| Package | Purpose |
|---|---|
| [`tyndale`](../tyndale) | CLI — `init`, `extract`, `translate`, `validate`, and more |
| [`tyndale-next`](../tyndale-next) | Next.js adapter — middleware, server provider, static generation |
