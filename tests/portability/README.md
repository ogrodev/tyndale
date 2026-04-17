# Portability tests

These tests guard against the class of bug that **dev-harness testing actively
hides**: workspace symlinks and bundler transforms make published-tarball
problems invisible until a user installs from npm.

The class of bug we've shipped and want to never ship again:

- Bun-only APIs (`from 'bun'`, `Bun.*`, `import.meta.main`) in code that
  consumers run under Node.
- ESM imports without explicit `.js` extensions — Node's strict resolver
  rejects them; Vite/webpack/Bun silently rewrite.
- Missing shebang on published bin scripts.
- Stale `dist/` overriding source changes in workspace installs.
- Symlink path drift (e.g., macOS `/tmp` → `/private/tmp`) breaking
  `import.meta.url === process.argv[1]` main-module checks.
- Server-only code leaking into the main library barrel, breaking client
  bundles (e.g., Next.js App Router).
- Client-side hooks/context in library source without `'use client'`, which
  Next's RSC boundary rejects.

Four layers, cheapest first:

## Layer 1 — static portability lint

**Where:** `packages/*/tests/portability.test.ts`, helper at
`tests/portability/lib.ts`.
**Cost:** ~50 ms per package. Runs in every `bun test`.

Scans `src/` (and `dist/` when it exists) for forbidden patterns and missing
import extensions. Optionally asserts the bin file starts with
`#!/usr/bin/env node`.

Catches: Bun imports, `Bun.*` access, `import.meta.main`, extensionless ESM
imports, missing shebang.

## Layer 2 — pack + install E2E

**Where:** `tests/e2e/portability.test.ts`, harness at
`tests/portability/harness.ts`, fixture at `tests/portability/fixture-template/`.
**Cost:** ~30 s per runtime on a warm npm cache.

Packs each package with `bun pm pack`, installs the tarballs into a fresh
project (no workspace symlinks, no bundler), and runs:

- `node node_modules/tyndale/dist/cli.js <args>` and the same under `bun`,
  covering `--help`, `extract`, `validate`.
- Dynamic `import('tyndale-react')` and `import('tyndale-react/server')` from
  the installed project under each runtime.

Catches: stale `dist/`, peerDep resolution, packaging mistakes, symlink path
issues, shebang drift in the emitted bin, any API that only worked because a
bundler rewrote it.

Run locally with:
```
bun run build:packages
bun test tests/e2e/portability.test.ts
```

Skip during inner-loop dev with `SKIP_PORTABILITY_E2E=1`.

## Layer 3 — Next.js integration E2E (Playwright)

**Where:** `tests/playwright/next-integration.spec.ts`, config at
`tests/playwright/playwright.config.ts`, fixture at `tests/e2e/fixture/`.
**Cost:** ~15 s including `next build` on first run.

Boots the workspace fixture (minimal Next.js 16 App Router app) with
`next start` against a real production build, then drives HTTP requests:

- `GET /` → assert middleware redirects to the default locale
- `GET /en` and `GET /es` → assert the correct server-rendered translations
  appear for `<T>`, `useTranslation`, and `msg`
- `<html lang>` is set from the locale cookie / header
- Raw HTML (no JS) contains Spanish strings and does NOT contain English
  sources — proves `TyndaleServerProvider` runs on the server, not just
  hydrated on the client

Playwright's `webServer` chains `tests/playwright/global-setup.ts` (runs
`tyndale extract` + seeds canned Spanish translations + `next build`) with
`next start`. The fixture's `public/` and `.next/` are gitignored.

Run locally with:
```
bun run build:packages
bun run test:playwright
```

Catches: RSC boundary violations (`'use client'` missing in library source),
server-only code leaking into client bundles, middleware logic regressions,
SSR vs. hydration divergence, and any break in the `tyndale-react` ↔
`tyndale-next` ↔ Next.js integration surface.

## Layer 4 — CI matrix

**Where:** `.github/workflows/portability.yml`.

- `static-lint` — Layer 1, ubuntu only.
- `packed-install` — Layer 2 across **{ubuntu, macOS, Windows} × {Node 20, 22,
  24} + Bun latest**.
- `next-integration` — Layer 3 across **{Node 20, 22, 24}** on ubuntu only
  (Next.js runtime behaviour is not OS-sensitive; Playwright on Windows/macOS
  adds cost for little signal).

Each matrix cell is independent; `fail-fast: false` reports every failure.

## When to update these tests

- **Added a new published package?** Add a `portability.test.ts` for it and
  extend `tests/portability/harness.ts` with a new tarball entry.
- **Added a new public library export?** Extend the `assertImport` calls in
  `tests/e2e/portability.test.ts` to cover the new specifier + exports.
- **Changed how the CLI invokes itself?** The main-module check
  (`isMainModule()` in `packages/tyndale/src/cli.ts`) must stay symlink-safe.
  Keep `realpathSync` on both sides.
- **Added a new runtime dependency to the CLI?** If it's Bun-only, wrap it so
  both runtimes work. Otherwise, Layer 2 will fail in the `node` cells.
- **Added a new fixture page / component in `tests/e2e/fixture/app/`?** Bump
  the canned Spanish translations in `tests/playwright/global-setup.ts`
  (hashes are deterministic — run `tyndale extract` once and copy the new
  keys). Add assertions for the new strings in the Playwright spec.
- **Added a new client hook / context to `tyndale-react`?** Add `'use client'`
  at the top of the source file. Layer 3 (Next build) will reject it
  otherwise.
