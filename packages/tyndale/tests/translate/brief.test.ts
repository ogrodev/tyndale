import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  loadBrief,
  saveBrief,
  buildBriefGenerationPrompt,
  sampleEntriesForBrief,
} from '../../src/translate/brief';
import type { TranslationInput } from '../../src/translate/pi-session';

const TMP_DIR = join(import.meta.dir, '__fixtures__/brief-test');

function makeEntry(i: number): TranslationInput {
  return {
    hash: `hash-${i}`,
    source: `Source ${i}`,
    context: `context-${i}`,
    type: 'text',
  };
}

describe('brief', () => {
  beforeEach(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe('loadBrief', () => {
    it('returns null when file does not exist', () => {
      expect(loadBrief(TMP_DIR, 'fr')).toBeNull();
    });
  });

  describe('saveBrief + loadBrief round-trip', () => {
    it('saves and loads content correctly', () => {
      const content = '# French Brief\n\nUse "tu" for informal tone.';
      saveBrief(TMP_DIR, 'fr', content);
      expect(loadBrief(TMP_DIR, 'fr')).toBe(content);
    });
  });

  describe('saveBrief', () => {
    it('creates directories recursively', () => {
      const nested = join(TMP_DIR, 'deep/nested');
      saveBrief(nested, 'de', 'content');
      expect(existsSync(join(nested, '.tyndale/briefs/de.md'))).toBe(true);
    });
  });

  describe('sampleEntriesForBrief', () => {
    it('returns all entries when under maxSamples', () => {
      const entries = Array.from({ length: 5 }, (_, i) => makeEntry(i));
      const result = sampleEntriesForBrief(entries, 10);
      expect(result).toEqual(entries);
      expect(result).toBe(entries); // same reference
    });

    it('returns exactly maxSamples entries when over', () => {
      const entries = Array.from({ length: 200 }, (_, i) => makeEntry(i));
      const result = sampleEntriesForBrief(entries, 50);
      expect(result).toHaveLength(50);
    });

    it('samples are evenly distributed', () => {
      const entries = Array.from({ length: 200 }, (_, i) => makeEntry(i));
      const result = sampleEntriesForBrief(entries, 10);
      // First element is always included
      expect(result[0]).toEqual(entries[0]);
      // Last sampled element should be near the end
      const lastSampled = result[result.length - 1];
      const lastIndex = entries.indexOf(lastSampled);
      expect(lastIndex).toBeGreaterThanOrEqual(180);
    });
  });

  describe('buildBriefGenerationPrompt', () => {
    it('contains locale, language name, default locale, and sample entries', () => {
      const entries: TranslationInput[] = [
        { hash: 'h1', source: 'Save changes', context: 'button', type: 'cta' },
        { hash: 'h2', source: 'Welcome back', context: 'greeting', type: 'text' },
      ];

      const prompt = buildBriefGenerationPrompt(entries, 'pt-BR', 'Brazilian Portuguese', 'en');

      expect(prompt).toContain('pt-BR');
      expect(prompt).toContain('Brazilian Portuguese');
      expect(prompt).toContain('en');
      expect(prompt).toContain('"Save changes" (cta, button)');
      expect(prompt).toContain('"Welcome back" (text, greeting)');
      expect(prompt).toContain('2 entries');
    });
  });
});
