// packages/tyndale/tests/translate/retry.test.ts
import { describe, it, expect } from 'bun:test';
import { withRetry } from '../../src/translate/retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries on failure and succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('fail');
      return 'recovered';
    }, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe('recovered');
    expect(calls).toBe(3);
  });

  it('throws after exhausting all retries', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error('persistent failure');
      }, { maxAttempts: 3, baseDelayMs: 0 }),
    ).rejects.toThrow('persistent failure');
    expect(calls).toBe(3);
  });

  it('uses default of 3 attempts', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error('fail');
      }, { baseDelayMs: 0 }),
    ).rejects.toThrow('fail');
    expect(calls).toBe(3);
  });

  it('calls onRetry callback with attempt and error', async () => {
    const retries: Array<{ attempt: number; error: string }> = [];
    let calls = 0;
    await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error(`fail-${calls}`);
        return 'ok';
      },
      {
        maxAttempts: 3,
        baseDelayMs: 0,
        onRetry: (attempt, err) => retries.push({ attempt, error: err.message }),
      },
    );
    expect(retries).toEqual([
      { attempt: 2, error: 'fail-1' },
      { attempt: 3, error: 'fail-2' },
    ]);
  });
});
