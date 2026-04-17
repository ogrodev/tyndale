import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Normalizes whitespace: trims and collapses runs of whitespace to a single space.
 */
function normalizeWhitespace(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

/**
 * Computes a SHA-256 hex hash of the given content after whitespace normalization.
 * Used by both the CLI (extraction) and the runtime (lookup) to produce
 * identical hashes for the same logical content.
 *
 * Universal: pure JS. Runs in Node, Bun, and the browser. Called synchronously
 * from client components (`<T>`, `msg`, `useTranslation`) at render time, so it
 * must not depend on platform APIs.
 */
export function computeHash(content: string): string {
  const normalized = normalizeWhitespace(content);
  return bytesToHex(sha256(normalized));
}

/** Alias for use in Phase 2A code. */
export const hash = computeHash;
