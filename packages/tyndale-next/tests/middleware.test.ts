// packages/tyndale-next/tests/middleware.test.ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createTyndaleMiddleware } from '../src/middleware';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Helper to build a NextRequest-like object for testing.
 * We use the real NextRequest constructor from next/server.
 */
function makeRequest(
  urlPath: string,
  options?: {
    cookies?: Record<string, string>;
    acceptLanguage?: string;
  },
): NextRequest {
  const url = new URL(urlPath, 'http://localhost:3000');
  const headers = new Headers();
  if (options?.acceptLanguage) {
    headers.set('accept-language', options.acceptLanguage);
  }
  const req = new NextRequest(url, { headers });
  // Bun test strips cookie headers from Request objects, so use the
  // NextRequest cookies API directly to set cookies for testing.
  if (options?.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      req.cookies.set(name, value);
    }
  }
  return req;
}

describe('createTyndaleMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TYNDALE_DEFAULT_LOCALE = 'en';
    process.env.TYNDALE_LOCALES = JSON.stringify(['es', 'fr', 'ja']);
    process.env.TYNDALE_COOKIE_NAME = 'TYNDALE_LOCALE';
    process.env.TYNDALE_LOCALE_ALIASES = JSON.stringify({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('redirects to default locale when no locale in URL', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/about');
  });

  test('redirects root path to default locale root', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en');
  });

  test('passes through when URL has a valid locale prefix', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/es/about');
    const res = middleware(req);
    // Should rewrite, not redirect — the locale is valid
    expect(res.status).not.toBe(307);
    expect(res.headers.get('x-tyndale-locale')).toBe('es');
  });

  test('sets x-tyndale-locale header for valid locale', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/fr/contact');
    const res = middleware(req);
    expect(res.headers.get('x-tyndale-locale')).toBe('fr');
  });

  test('sets TYNDALE_LOCALE cookie on response', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/es/page');
    const res = middleware(req);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('TYNDALE_LOCALE=es');
  });

  test('detects locale from cookie when no locale in URL', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about', { cookies: { TYNDALE_LOCALE: 'fr' } });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/fr/about');
  });

  test('detects locale from Accept-Language when no URL locale or cookie', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about', { acceptLanguage: 'ja;q=0.9, en;q=0.8' });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/ja/about');
  });

  test('falls back to default locale if Accept-Language has no supported locale', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about', { acceptLanguage: 'de;q=0.9, zh;q=0.8' });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/about');
  });

  test('redirects unsupported locale prefix to default locale', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/de/about');
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/about');
  });

  test('resolves locale alias in URL path', () => {
    process.env.TYNDALE_LOCALE_ALIASES = JSON.stringify({ 'pt-BR': 'pt' });
    process.env.TYNDALE_LOCALES = JSON.stringify(['es', 'pt']);
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/pt-BR/about');
    const res = middleware(req);
    // Should redirect to canonical locale
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/pt/about');
  });

  test('resolves locale alias from cookie', () => {
    process.env.TYNDALE_LOCALE_ALIASES = JSON.stringify({ 'en-US': 'en' });
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about', { cookies: { TYNDALE_LOCALE: 'en-US' } });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/en/about');
  });

  test('resolves locale alias from Accept-Language', () => {
    process.env.TYNDALE_LOCALE_ALIASES = JSON.stringify({ 'es-MX': 'es' });
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about', { acceptLanguage: 'es-MX' });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/es/about');
  });

  test('default locale in URL is accepted without redirect', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/en/about');
    const res = middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get('x-tyndale-locale')).toBe('en');
  });

  test('preserves query string during redirect', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about?ref=home&utm=test');
    const res = middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get('location')!;
    expect(location).toContain('/en/about');
    expect(location).toContain('ref=home');
    expect(location).toContain('utm=test');
  });

  test('URL locale takes priority over cookie', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/fr/page', { cookies: { TYNDALE_LOCALE: 'es' } });
    const res = middleware(req);
    expect(res.headers.get('x-tyndale-locale')).toBe('fr');
  });

  test('cookie takes priority over Accept-Language', () => {
    const middleware = createTyndaleMiddleware();
    const req = makeRequest('/about', {
      cookies: { TYNDALE_LOCALE: 'ja' },
      acceptLanguage: 'fr',
    });
    const res = middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/ja/about');
  });
});
