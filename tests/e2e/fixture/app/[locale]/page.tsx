'use client';

import { T, Var, Num, useTranslation, msg } from 'tyndale-react';

const NAV_ITEMS = [
  { label: msg('Home'), href: '/' },
  { label: msg('About'), href: '/about' },
];

export default function HomePage() {
  const t = useTranslation();
  const userName = 'Pedro';
  const itemCount = 5;

  return (
    <main>
      {/* JSX translation with nested elements */}
      <T>
        <h1>Welcome to Tyndale</h1>
        <p>The open-source i18n solution for React.</p>
      </T>

      {/* Variable components */}
      <T>
        <p>
          Hello <Var name="user">{userName}</Var>, you have{' '}
          <Num value={itemCount} /> items in your cart.
        </p>
      </T>

      {/* Hook-based string translation */}
      <input placeholder={t('Search products...')} />
      <button>{t('Sign in')}</button>

      {/* Shared strings via msg() */}
      <nav>
        {NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </main>
  );
}
