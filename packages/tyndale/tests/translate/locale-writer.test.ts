// packages/tyndale/tests/translate/locale-writer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeLocaleFile, readLocaleFile } from '../../src/translate/locale-writer';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__fixtures__/locale-writer');

describe('locale-writer', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('readLocaleFile', () => {
    it('returns empty object for non-existent file', async () => {
      const data = await readLocaleFile(join(TEST_DIR, 'missing.json'));
      expect(data).toEqual({});
    });

    it('reads existing locale file', async () => {
      const filePath = join(TEST_DIR, 'es.json');
      await Bun.write(filePath, JSON.stringify({ hash1: 'Hola', hash2: 'Mundo' }));
      const data = await readLocaleFile(filePath);
      expect(data).toEqual({ hash1: 'Hola', hash2: 'Mundo' });
    });
  });

  describe('writeLocaleFile', () => {
    it('writes new translations to file', async () => {
      const filePath = join(TEST_DIR, 'es.json');
      await writeLocaleFile(filePath, {}, { hash1: 'Hola' }, []);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({ hash1: 'Hola' });
    });

    it('merges new translations with existing', async () => {
      const filePath = join(TEST_DIR, 'es.json');
      const existing = { hash1: 'Hola' };
      await writeLocaleFile(filePath, existing, { hash2: 'Mundo' }, []);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({ hash1: 'Hola', hash2: 'Mundo' });
    });

    it('removes stale hashes', async () => {
      const filePath = join(TEST_DIR, 'es.json');
      const existing = { hash1: 'Hola', stale1: 'Viejo', stale2: 'Antiguo' };
      await writeLocaleFile(filePath, existing, {}, ['stale1', 'stale2']);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({ hash1: 'Hola' });
    });

    it('handles simultaneous add and remove', async () => {
      const filePath = join(TEST_DIR, 'es.json');
      const existing = { old1: 'Viejo', keep: 'Mantener' };
      await writeLocaleFile(filePath, existing, { new1: 'Nuevo' }, ['old1']);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({ keep: 'Mantener', new1: 'Nuevo' });
    });

    it('writes sorted keys for deterministic output', async () => {
      const filePath = join(TEST_DIR, 'es.json');
      await writeLocaleFile(filePath, {}, { z: 'last', a: 'first', m: 'middle' }, []);
      const raw = readFileSync(filePath, 'utf-8');
      const keys = Object.keys(JSON.parse(raw));
      expect(keys).toEqual(['a', 'm', 'z']);
    });

    it('creates parent directories if needed', async () => {
      const filePath = join(TEST_DIR, 'nested/deep/fr.json');
      await writeLocaleFile(filePath, {}, { hash1: 'Bonjour' }, []);
      expect(existsSync(filePath)).toBe(true);
      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({ hash1: 'Bonjour' });
    });
  });
});
