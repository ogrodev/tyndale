import { describe, it, expect } from 'bun:test';
import { runPool } from '../../src/translate/pool';

describe('runPool', () => {
  it('returns results in same order as input items', async () => {
    const items = [10, 20, 30];
    const results = await runPool(items, 3, async (item) => item);
    expect(results).toEqual([10, 20, 30]);
  });

  it('respects concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    const results = await runPool(
      [1, 2, 3, 4, 5],
      2,
      async (item) => {
        active++;
        if (active > peak) peak = active;
        await new Promise((r) => setTimeout(r, 10));
        active--;
        return item;
      },
    );

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(0);
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty items array', async () => {
    const results = await runPool([], 3, async (item) => item);
    expect(results).toEqual([]);
  });

  it('handles single item', async () => {
    const results = await runPool([42], 3, async (item) => item * 2);
    expect(results).toEqual([84]);
  });

  it('propagates errors', async () => {
    const error = new Error('boom');
    await expect(
      runPool([1, 2, 3], 2, async (item) => {
        if (item === 2) throw error;
        return item;
      }),
    ).rejects.toThrow('boom');
  });

  it('works when concurrency exceeds item count', async () => {
    const results = await runPool([1, 2], 10, async (item) => item + 1);
    expect(results).toEqual([2, 3]);
  });
});
