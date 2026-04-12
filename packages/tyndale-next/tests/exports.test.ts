// packages/tyndale-next/tests/exports.test.ts
import { describe, expect, test } from 'bun:test';

describe('tyndale-next main exports', () => {
  test('exports TyndaleServerProvider', async () => {
    const mod = await import('../src/index');
    expect(mod.TyndaleServerProvider).toBeDefined();
    expect(typeof mod.TyndaleServerProvider).toBe('function');
  });

  test('exports TyndaleNextClientProvider', async () => {
    const mod = await import('../src/index');
    expect(mod.TyndaleNextClientProvider).toBeDefined();
    expect(typeof mod.TyndaleNextClientProvider).toBe('function');
  });

  test('exports generateStaticLocaleParams', async () => {
    const mod = await import('../src/index');
    expect(mod.generateStaticLocaleParams).toBeDefined();
    expect(typeof mod.generateStaticLocaleParams).toBe('function');
  });

  test('exports useDirection', async () => {
    const mod = await import('../src/index');
    expect(mod.useDirection).toBeDefined();
    expect(typeof mod.useDirection).toBe('function');
  });

  test('exports TyndaleCache', async () => {
    const mod = await import('../src/index');
    expect(mod.TyndaleCache).toBeDefined();
    expect(typeof mod.TyndaleCache).toBe('function');
  });
});

describe('tyndale-next/config subpath', () => {
  test('exports withTyndaleConfig', async () => {
    const mod = await import('../src/config');
    expect(mod.withTyndaleConfig).toBeDefined();
    expect(typeof mod.withTyndaleConfig).toBe('function');
  });
});

describe('tyndale-next/middleware subpath', () => {
  test('exports createTyndaleMiddleware', async () => {
    const mod = await import('../src/middleware');
    expect(mod.createTyndaleMiddleware).toBeDefined();
    expect(typeof mod.createTyndaleMiddleware).toBe('function');
  });
});
