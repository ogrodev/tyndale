// packages/tyndale-react/tests/exports.test.ts
import { describe, test, expect } from 'bun:test';

describe('tyndale-react exports', () => {
  test('exports all Phase 2A public APIs', async () => {
    const mod = await import('../src/index');

    // Phase 1 exports (should still exist)
    expect(mod.TyndaleProvider).toBeDefined();
    expect(mod.TyndaleContext).toBeDefined();
    expect(mod.useLocale).toBeDefined();
    expect(mod.T).toBeDefined();
    expect(mod.useTranslation).toBeDefined();
    expect(mod.hash).toBeDefined();

    // Phase 2A: Variable components
    expect(mod.Var).toBeDefined();
    expect(mod.Num).toBeDefined();
    expect(mod.Currency).toBeDefined();
    expect(mod.DateTime).toBeDefined();
    expect(mod.Plural).toBeDefined();

    // Phase 2A: Hooks and functions
    // (getTranslation is server-only — lives under tyndale-react/server)
    expect(mod.msg).toBeDefined();
    expect(mod.useChangeLocale).toBeDefined();
    expect(mod.useDictionary).toBeDefined();

    // Phase 2A: Types (re-exported for consumers)
    // Types don't exist at runtime, but the module should not throw
  });

  test('getTranslation is exported from /server (not from main barrel)', async () => {
    const main = await import('../src/index');
    expect((main as Record<string, unknown>).getTranslation).toBeUndefined();
    const server = await import('../src/server');
    expect(server.getTranslation).toBeDefined();
  });
});
