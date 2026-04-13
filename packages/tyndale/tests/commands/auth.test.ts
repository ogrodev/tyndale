// packages/tyndale/tests/commands/auth.test.ts
//
// The auth command now uses TUI selectors for provider selection.
// Unit tests cover the non-interactive parts: Pi AuthStorage integration
// and the runAuth CLI entry point's subcommand routing.

import { describe, it, expect, mock } from 'bun:test';

describe('auth command', () => {
  describe('runAuth', () => {
    it('routes status subcommand', async () => {
      // Mock the Pi SDK
      const fakeAuthStorage = {
        list: () => ['anthropic'],
        get: (p: string) => ({ type: 'api_key', key: 'sk-test' }),
        getOAuthProviders: () => [],
      };

      mock.module('@mariozechner/pi-coding-agent', () => ({
        AuthStorage: { create: () => fakeAuthStorage },
        ModelRegistry: { create: () => ({ refresh() {}, getAll: () => [] }) },
      }));

      const { runAuth } = await import('../../src/commands/auth');
      const origLog = console.log;
      const output: string[] = [];
      console.log = (msg: string) => output.push(msg);

      try {
        const result = await runAuth({ _sub: 'status' });
        expect(result.exitCode).toBe(0);
        expect(output.some((l) => l.includes('anthropic'))).toBe(true);
      } finally {
        console.log = origLog;
      }
    });

    it('status returns 1 when no providers authenticated', async () => {
      const fakeAuthStorage = {
        list: () => [],
        get: () => undefined,
        getOAuthProviders: () => [],
      };

      mock.module('@mariozechner/pi-coding-agent', () => ({
        AuthStorage: { create: () => fakeAuthStorage },
        ModelRegistry: { create: () => ({ refresh() {}, getAll: () => [] }) },
      }));

      const { runAuth } = await import('../../src/commands/auth');
      const origLog = console.log;
      const output: string[] = [];
      console.log = (msg: string) => output.push(msg);

      try {
        const result = await runAuth({ _sub: 'status' });
        expect(result.exitCode).toBe(1);
        expect(output.some((l) => l.includes('No providers'))).toBe(true);
      } finally {
        console.log = origLog;
      }
    });
  });
});
