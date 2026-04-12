// packages/tyndale/tests/translate/wire-validator.test.ts
import { describe, it, expect } from 'bun:test';
import { validateTranslation, type ValidationResult } from '../../src/translate/wire-validator';

describe('validateTranslation', () => {
  describe('valid translations', () => {
    it('accepts identical tag structure', () => {
      const result = validateTranslation(
        '<0>Welcome to <1>our app</1></0>',
        '<0>Bienvenido a <1>nuestra aplicación</1></0>',
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts reordered sibling tags', () => {
      const result = validateTranslation(
        '<0>Hello</0><1>World</1>',
        '<1>Mundo</1><0>Hola</0>',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts plain text without tags', () => {
      const result = validateTranslation('Hello world', 'Hola mundo');
      expect(result.valid).toBe(true);
    });

    it('accepts preserved variable placeholders', () => {
      const result = validateTranslation(
        'Hello {name}, you have {count} messages',
        'Hola {name}, tienes {count} mensajes',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts reordered placeholders', () => {
      const result = validateTranslation(
        '{count} messages for {name}',
        '{name} tiene {count} mensajes',
      );
      expect(result.valid).toBe(true);
    });

    it('accepts tags with placeholders', () => {
      const result = validateTranslation(
        '<0>Hello {name}</0>',
        '<0>Hola {name}</0>',
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('missing tags', () => {
    it('rejects translation missing a numbered tag', () => {
      const result = validateTranslation(
        '<0>Hello</0><1>World</1>',
        '<0>Hola</0>',
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing tag: <1>');
    });

    it('rejects translation missing closing tag', () => {
      const result = validateTranslation(
        '<0>Hello</0>',
        '<0>Hola',
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing closing tag: </0>');
    });
  });

  describe('invented tags', () => {
    it('rejects translation with invented tag', () => {
      const result = validateTranslation(
        '<0>Hello</0>',
        '<0>Hola</0><5>Extra</5>',
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invented tag: <5>');
    });
  });

  describe('unbalanced tags', () => {
    it('rejects unmatched opening tag', () => {
      const result = validateTranslation(
        '<0>Hello</0>',
        '<0>Hola<0>',
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('</0>'))).toBe(true);
    });
  });

  describe('missing placeholders', () => {
    it('rejects translation missing a placeholder', () => {
      const result = validateTranslation(
        'Hello {name}, you have {count} items',
        'Hola {name}, tienes elementos',
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing placeholder: {count}');
    });

    it('rejects translation with invented placeholder', () => {
      const result = validateTranslation(
        'Hello {name}',
        'Hola {name} {extra}',
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invented placeholder: {extra}');
    });
  });

  describe('string type entries', () => {
    it('validates string entries (no tags expected)', () => {
      const result = validateTranslation('Enter your email', 'Ingrese su correo');
      expect(result.valid).toBe(true);
    });
  });
});
