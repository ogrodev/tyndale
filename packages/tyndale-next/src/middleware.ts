// packages/tyndale-next/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseAcceptLanguage, resolveAlias } from './locale-utils.js';

/**
 * Reads Tyndale configuration from build-time environment variables
 * set by withTyndaleConfig().
 */
function getConfig() {
  const defaultLocale = process.env.TYNDALE_DEFAULT_LOCALE!;
  const locales: string[] = JSON.parse(process.env.TYNDALE_LOCALES ?? '[]');
  const cookieName = process.env.TYNDALE_COOKIE_NAME ?? 'TYNDALE_LOCALE';
  const aliases: Record<string, string> = JSON.parse(
    process.env.TYNDALE_LOCALE_ALIASES ?? '{}',
  );
  const allLocales = [defaultLocale, ...locales];
  return { defaultLocale, locales, allLocales, cookieName, aliases };
}

/**
 * Extracts the first path segment from a URL pathname.
 * "/es/about" → "es", "/" → "", "/about" → "about"
 */
function extractPathLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] ?? '';
}

/**
 * Removes the first path segment (locale prefix) from a pathname.
 * "/es/about" → "/about", "/es" → "/"
 */
function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const rest = segments.slice(1).join('/');
  return rest ? `/${rest}` : '/';
}

/**
 * Checks if a string looks like a locale code (2-3 letters, optionally with region).
 * This is a heuristic to avoid treating "/about" as a locale.
 */
function looksLikeLocale(segment: string): boolean {
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?$/.test(segment);
}

/**
 * Creates a Next.js middleware function that handles locale detection and routing.
 *
 * Locale detection priority:
 * 1. URL path prefix (/es/about)
 * 2. TYNDALE_LOCALE cookie
 * 3. Accept-Language header
 * 4. Default locale (fallback)
 *
 * Behavior:
 * - If no locale in URL: redirects to /{detectedLocale}/current-path
 * - If URL has unsupported locale: redirects to /{defaultLocale}/rest-of-path
 * - If URL has alias locale: redirects to /{canonicalLocale}/rest-of-path
 * - If URL has valid locale: rewrites with x-tyndale-locale header + sets cookie
 *
 * Usage:
 * ```ts
 * // middleware.ts
 * import { createTyndaleMiddleware } from 'tyndale-next/middleware';
 * export default createTyndaleMiddleware();
 * export const config = { matcher: ['/((?!api|_next|_tyndale|.*\\..*).*)'] };
 * ```
 */
export function createTyndaleMiddleware() {
  return function tyndaleMiddleware(request: NextRequest): NextResponse {
    const { defaultLocale, allLocales, cookieName, aliases } = getConfig();
    const { pathname, search } = request.nextUrl;

    const firstSegment = extractPathLocale(pathname);
    const hasLocalePrefix = firstSegment && looksLikeLocale(firstSegment);

    if (hasLocalePrefix) {
      // Resolve alias first
      const resolved = resolveAlias(firstSegment, aliases);

      // If the alias resolved to a different locale, redirect to canonical URL
      if (resolved !== firstSegment && allLocales.includes(resolved)) {
        const restPath = stripLocalePrefix(pathname);
        const redirectUrl = new URL(`/${resolved}${restPath}${search}`, request.url);
        const response = NextResponse.redirect(redirectUrl, 307);
        response.cookies.set(cookieName, resolved, { path: '/' });
        return response;
      }

      // If the locale is supported, pass through with header
      if (allLocales.includes(firstSegment)) {
        const response = NextResponse.next({
          headers: { 'x-tyndale-locale': firstSegment },
        });
        response.cookies.set(cookieName, firstSegment, { path: '/' });
        return response;
      }

      // Unsupported locale prefix — redirect to default with the rest of the path
      const restPath = stripLocalePrefix(pathname);
      const redirectUrl = new URL(
        `/${defaultLocale}${restPath}${search}`,
        request.url,
      );
      const response = NextResponse.redirect(redirectUrl, 307);
      response.cookies.set(cookieName, defaultLocale, { path: '/' });
      return response;
    }

    // No locale in URL — detect from cookie, then Accept-Language, then default
    const detectedLocale = detectLocale(request, allLocales, cookieName, aliases, defaultLocale);

    // Build redirect path: /{locale}/current-path
    const redirectPath = pathname === '/' ? '' : pathname;
    const redirectUrl = new URL(
      `/${detectedLocale}${redirectPath}${search}`,
      request.url,
    );
    const response = NextResponse.redirect(redirectUrl, 307);
    response.cookies.set(cookieName, detectedLocale, { path: '/' });
    return response;
  };
}

/**
 * Detects the best locale from cookie and Accept-Language header.
 * Returns the first supported locale found, or the default.
 */
function detectLocale(
  request: NextRequest,
  allLocales: string[],
  cookieName: string,
  aliases: Record<string, string>,
  defaultLocale: string,
): string {
  // 1. Check cookie
  const cookieLocale = request.cookies.get(cookieName)?.value;
  if (cookieLocale) {
    const resolved = resolveAlias(cookieLocale, aliases);
    if (allLocales.includes(resolved)) {
      return resolved;
    }
  }

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferred = parseAcceptLanguage(acceptLanguage);
    for (const candidate of preferred) {
      const resolved = resolveAlias(candidate, aliases);
      if (allLocales.includes(resolved)) {
        return resolved;
      }
      // Also try the primary subtag: "en-US" → "en"
      const primary = candidate.split('-')[0];
      const resolvedPrimary = resolveAlias(primary, aliases);
      if (allLocales.includes(resolvedPrimary)) {
        return resolvedPrimary;
      }
    }
  }

  // 3. Fallback to default
  return defaultLocale;
}
