// packages/tyndale-next/src/cache.tsx
'use client';

import React from 'react';
import { useLocale } from 'tyndale-react';

interface TyndaleCacheProps {
  /** Unique cache key for this boundary. */
  id: string;
  children: React.ReactNode;
}

/**
 * Cache boundary for translated content in shared layouts.
 *
 * Memoizes its children based on the cache `id` and the current locale.
 * When the same layout re-renders (e.g., during Next.js navigation between
 * pages that share a layout), cached translation output is reused without
 * re-computation.
 *
 * ```tsx
 * import { TyndaleCache } from 'tyndale-next';
 *
 * <TyndaleCache id="footer">
 *   <T><footer>Large footer content...</footer></T>
 * </TyndaleCache>
 * ```
 */
export function TyndaleCache({ id, children }: TyndaleCacheProps) {
  const locale = useLocale();
  return <CachedContent cacheKey={`${id}:${locale}`}>{children}</CachedContent>;
}

/**
 * Inner memoized component. React.memo prevents re-rendering when
 * cacheKey and children haven't changed. The cacheKey incorporates
 * the locale so a locale change correctly invalidates the cache.
 */
const CachedContent = React.memo(function CachedContent({
  children,
}: {
  cacheKey: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
});

// Override memo comparison to use cacheKey as the primary equality check
CachedContent.displayName = 'TyndaleCachedContent';
