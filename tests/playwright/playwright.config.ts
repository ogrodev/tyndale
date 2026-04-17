import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(__dirname, '..', 'e2e', 'fixture');
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4320);

/**
 * Layer A: Next.js integration E2E.
 *
 * Boots the workspace fixture with `next start` against a pre-built `.next/`
 * and drives real HTTP requests against it. Exercises:
 *   - middleware redirect (tyndale-next/middleware)
 *   - `<html lang>` / `<html dir>` set by the layout tree
 *   - server-side render of <T>, useTranslation, msg via TyndaleServerProvider
 *   - client-side locale switch (useChangeLocale)
 *
 * Run locally:
 *   bun run build:packages
 *   bun run test:playwright
 *
 * The `globalSetup` hook runs `tyndale extract` + seeds Spanish translations
 * + `next build` on every run, so the fixture source dir never accumulates
 * generated artefacts (other e2e tests run against the same fixture).
 *
 * The `webServer` hook boots `next start` on demand and tears it down at end
 * of run.
 */
export default defineConfig({
  testDir: '.',

  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: false, // single webServer instance \u2014 no contention
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Chain setup — tyndale extract + seed · next build · next start.
    // globalSetup would be cleaner but Playwright does not await it before
    // launching webServer.
    command:
      `bun ${resolve(__dirname, 'global-setup.ts')} && bunx next start --port ${PORT} --hostname 127.0.0.1`,
    cwd: FIXTURE_DIR,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
