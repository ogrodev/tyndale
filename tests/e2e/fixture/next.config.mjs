import { readFileSync } from 'node:fs';

const raw = readFileSync(new URL('./tyndale.config.json', import.meta.url), 'utf-8');
const tyndale = JSON.parse(raw);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TYNDALE_DEFAULT_LOCALE: tyndale.defaultLocale,
    TYNDALE_LOCALES: JSON.stringify(tyndale.locales),
    TYNDALE_COOKIE_NAME: 'TYNDALE_LOCALE',
    TYNDALE_LOCALE_ALIASES: JSON.stringify(tyndale.localeAliases || {}),
    TYNDALE_OUTPUT: tyndale.output || 'public/_tyndale',
  },
};

export default nextConfig;
