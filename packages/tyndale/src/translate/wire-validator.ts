// packages/tyndale/src/translate/wire-validator.ts

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Extract all numbered tags like <0>, </0>, <12>, </12> from a wire format string. */
function extractNumberedTags(text: string): { opening: Set<string>; closing: Set<string> } {
  const opening = new Set<string>();
  const closing = new Set<string>();

  const openRe = /<(\d+)>/g;
  const closeRe = /<\/(\d+)>/g;

  let m: RegExpExecArray | null;
  while ((m = openRe.exec(text)) !== null) opening.add(m[1]);
  while ((m = closeRe.exec(text)) !== null) closing.add(m[1]);

  return { opening, closing };
}

/** Extract all variable placeholders like {name}, {count} from a wire format string. */
function extractPlaceholders(text: string): Set<string> {
  const placeholders = new Set<string>();
  // Match {word} but not numbered tags <0> — placeholders use { } not < >
  const re = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    placeholders.add(m[1]);
  }
  return placeholders;
}

/**
 * Validates a translated wire format string against the source.
 *
 * Rules:
 * - All numbered tags from source must appear in translation (no missing)
 * - No invented tags (tags in translation not in source)
 * - Tags must be balanced (every <N> has a </N>)
 * - All variable placeholders from source must appear (no missing)
 * - No invented placeholders
 * - Reordering of tags and placeholders is allowed
 */
export function validateTranslation(source: string, translation: string): ValidationResult {
  const errors: string[] = [];

  const srcTags = extractNumberedTags(source);
  const trnTags = extractNumberedTags(translation);

  // All source tags (by number) — union of opening and closing
  const srcTagNumbers = new Set([...srcTags.opening, ...srcTags.closing]);
  const trnTagNumbers = new Set([...trnTags.opening, ...trnTags.closing]);

  // Missing tags: in source but not in translation
  for (const num of srcTagNumbers) {
    if (!trnTags.opening.has(num)) {
      errors.push(`Missing tag: <${num}>`);
    }
    if (!trnTags.closing.has(num)) {
      errors.push(`Missing closing tag: </${num}>`);
    }
  }

  // Invented tags: in translation but not in source
  for (const num of trnTagNumbers) {
    if (!srcTagNumbers.has(num)) {
      errors.push(`Invented tag: <${num}>`);
    }
  }

  // Balance check: every opening tag in translation must have a closing tag
  for (const num of trnTags.opening) {
    if (!trnTags.closing.has(num) && srcTagNumbers.has(num)) {
      // Only report if not already reported as missing
      if (!errors.some((e) => e.includes(`</${num}>`))) {
        errors.push(`Unbalanced tag: <${num}> has no closing </${num}>`);
      }
    }
  }

  // Placeholder validation
  const srcPlaceholders = extractPlaceholders(source);
  const trnPlaceholders = extractPlaceholders(translation);

  for (const ph of srcPlaceholders) {
    if (!trnPlaceholders.has(ph)) {
      errors.push(`Missing placeholder: {${ph}}`);
    }
  }

  for (const ph of trnPlaceholders) {
    if (!srcPlaceholders.has(ph)) {
      errors.push(`Invented placeholder: {${ph}}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
