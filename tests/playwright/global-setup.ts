import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(__dirname, '..', 'e2e', 'fixture');
const CLI = resolve(__dirname, '..', '..', 'packages', 'tyndale', 'dist', 'cli.js');
const TRANSLATIONS_DIR = resolve(FIXTURE_DIR, 'public', '_tyndale');

/**
 * Canned Spanish translations for the fixture. Keyed by the SHA-256 hash that
 * `tyndale extract` produces from the wire format of the fixture's sources.
 * If the fixture strings change, update these values accordingly (the hash is
 * deterministic \u2014 rebuild the fixture and copy the new keys).
 */
const ES_TRANSLATIONS: Record<string, string> = {
  '1d20d72a6b9339a6679964e113fe2cb0dad0f9bcd6b076210fe8e6d45efc6dd4':
    '<0>Bienvenido a Tyndale</0><1>La solución i18n de código abierto para React.</1>',
  'b70d8fcc4e27c6652adb009c25ee5bbba5ff6cbb98f0e2ac7000aec6888fabc6':
    '<0>Hola {user}, tienes {itemCount} artículos en tu carrito.</0>',
  '3a78695388b38b5cceefaf6796b0137877514593543b91af2752d5a17e3d736c': 'Inicio',
  '4efca0d10c5feb8e9b35eb1d994f2905bb71714e6a271f511d713b539ea5faa1': 'Acerca de',
  'b53c7752ef0d9bc9a766089db1a5e9f26ac5071e4a2662008f9fd382ca2d06ff': 'Buscar productos...',
  'bfd402b2f6f3812529b55596136d3a11c51616317e3b1cd999928e2d4eae7d3f': 'Iniciar sesión',
};

/**
 * Playwright global setup.
 *
 * Prepares the fixture for `next start`:
 *   1. `tyndale extract` \u2014 generates manifest.json + en.json from sources
 *   2. Writes canned es.json (no AI needed; keeps the test deterministic)
 *   3. `next build` \u2014 produces the .next/ dir that `next start` serves
 *
 * This keeps the fixture source directory clean of generated artefacts so
 * other e2e tests (tests/e2e/e2e*.test.ts) continue to run in isolation.
 */
export default async function globalSetup() {
  // Clean stale artefacts from prior runs.
  if (existsSync(TRANSLATIONS_DIR)) rmSync(TRANSLATIONS_DIR, { recursive: true });
  if (existsSync(resolve(FIXTURE_DIR, '.next'))) {
    rmSync(resolve(FIXTURE_DIR, '.next'), { recursive: true });
  }

  // 1. Extract.
  const extract = spawnSync('node', [CLI, 'extract'], {
    cwd: FIXTURE_DIR,
    stdio: 'inherit',
  });
  if (extract.status !== 0) {
    throw new Error('[playwright setup] tyndale extract failed');
  }

  // 2. Seed Spanish translations.
  mkdirSync(TRANSLATIONS_DIR, { recursive: true });
  writeFileSync(
    resolve(TRANSLATIONS_DIR, 'es.json'),
    JSON.stringify(ES_TRANSLATIONS, null, 2) + '\n',
  );

  // 3. Build the Next app.
  const build = spawnSync('bunx', ['next', 'build'], {
    cwd: FIXTURE_DIR,
    stdio: 'inherit',
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (build.status !== 0) {
    throw new Error('[playwright setup] next build failed');
  }
}

// Self-execute when run directly (e.g. via the Playwright webServer command).
// We intentionally always run as a script — Playwright's globalSetup hook does
// not await before starting `webServer`, so this module is invoked via the
// webServer command chain instead.
void globalSetup().catch((err) => {
  console.error(err);
  process.exit(1);
});
