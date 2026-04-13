import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import type { TranslationInput } from './pi-session';

const BRIEFS_DIR = '.tyndale/briefs';

export function loadBrief(projectRoot: string, locale: string): string | null {
  const briefPath = join(projectRoot, BRIEFS_DIR, `${locale}.md`);
  if (!existsSync(briefPath)) return null;
  return readFileSync(briefPath, 'utf-8');
}

export function saveBrief(projectRoot: string, locale: string, content: string): void {
  const briefPath = join(projectRoot, BRIEFS_DIR, `${locale}.md`);
  mkdirSync(dirname(briefPath), { recursive: true });
  writeFileSync(briefPath, content);
}

export function buildBriefGenerationPrompt(
  sampleEntries: TranslationInput[],
  localeCode: string,
  languageName: string,
  defaultLocale: string,
): string {
  const samples = sampleEntries
    .map((e) => `- "${e.source}" (${e.type}, ${e.context})`)
    .join('\n');

  return `You are a professional localization consultant. Analyze the following sample UI strings from an application and produce a Translation Brief for translating from ${defaultLocale} to ${languageName} (${localeCode}).

The brief must cover:

1. **App Context** — What kind of application this appears to be, based on the strings.
2. **Register & Formality** — What pronoun/formality level to use (e.g., "tu" vs "vous" in French, "du" vs "Sie" in German). Pick ONE and be specific.
3. **Tone** — Professional, casual, playful, technical, etc. Be specific.
4. **Term Decisions** — Terms that should stay in English (technical jargon, brand terms) vs. terms that should be translated. List specific examples from the samples.
5. **Patterns** — How to translate CTAs (imperative vs infinitive), error messages (tone, structure), empty states, confirmations, questions.

SAMPLE STRINGS (${sampleEntries.length} entries):
${samples}

Respond with ONLY the Translation Brief in Markdown format. No preamble, no explanation outside the brief.`;
}

export function sampleEntriesForBrief(
  entries: TranslationInput[],
  maxSamples: number = 100,
): TranslationInput[] {
  if (entries.length <= maxSamples) return entries;

  const step = entries.length / maxSamples;
  const sampled: TranslationInput[] = [];
  for (let i = 0; i < maxSamples; i++) {
    sampled.push(entries[Math.floor(i * step)]);
  }
  return sampled;
}
