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
 */
export function computeHash(content: string): string {
  const normalized = normalizeWhitespace(content);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  // Bun provides the Web Crypto API globally.
  // For synchronous hashing, use Bun's native hasher.
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(data);
  return hasher.digest('hex');
}


/** Alias for use in Phase 2A code. */
export const hash = computeHash;