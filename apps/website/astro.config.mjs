import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://tyndale.dev',
  output: 'static',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    starlight({
      title: 'Tyndale',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        es: { label: 'Español' },
        fr: { label: 'Français' },
        de: { label: 'Deutsch' },
        pt: { label: 'Português' },
        ja: { label: '日本語' },
        ko: { label: '한국어' },
        zh: { label: '中文' },
        it: { label: 'Italiano' },
        ru: { label: 'Русский' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ogrodev/tyndale' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            'getting-started/installation',
            'getting-started/quickstart',
            'getting-started/nextjs-setup',
          ],
        },
        {
          label: 'Guides',
          items: [
            'guides/adding-locales',
            'guides/dictionaries',
            'guides/ci-cd',
          ],
        },
        {
          label: 'Reference',
          items: [
            'reference/cli',
            'reference/react-api',
            'reference/next-api',
            'reference/configuration',
          ],
        },
      ],
      customCss: ['./src/styles/starlight-overrides.css'],
      editLink: {
        baseUrl: 'https://github.com/ogrodev/tyndale/edit/main/apps/website/',
      },
    }),
    react(),
  ],
});
