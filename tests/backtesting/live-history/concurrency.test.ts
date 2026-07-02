import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from '@/lib/backtesting/mlb/live-history/concurrency';

describe('mapWithConcurrency', () => {
  it('returns empty array for empty input', async () => {
    const result = await mapWithConcurrency([], 3, async () => 'x');
    expect(result).toEqual([]);
  });

  it('processes one item', async () => {
    const result = await mapWithConcurrency([1], 3, async (item) => item * 2);
    expect(result).toEqual([2]);
  });

  it('processes fewer items than limit', async () => {
    const result = await mapWithConcurrency([1, 2], 5, async (item) => item * 2);
    expect(result).toEqual([2, 4]);
  });

  it('processes more items than limit', async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => item * 2);
    expect(result).toEqual([2, 4, 6, 8]);
  });

  it('rejects on invalid limit zero', async () => {
    await expect(mapWithConcurrency([1], 0, async () => 'x')).rejects.toThrow(
      'Concurrency limit must be a positive integer',
    );
  });

  it('rejects on invalid negative limit', async () => {
    await expect(mapWithConcurrency([1], -1, async () => 'x')).rejects.toThrow(
      'Concurrency limit must be a positive integer',
    );
  });

  it('rejects on invalid non-integer limit', async () => {
    await expect(mapWithConcurrency([1], 1.5, async () => 'x')).rejects.toThrow(
      'Concurrency limit must be a positive integer',
    );
  });

  it('preserves input order despite out-of-order completion', async () => {
    const order: number[] = [];
    const result = await mapWithConcurrency(
      [1, 2, 3],
      2,
      async (item) => {
        order.push(item);
        await new Promise((resolve) => setTimeout(resolve, (4 - item) * 10));
        return item * 10;
      },
    );
    expect(result).toEqual([10, 20, 30]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('rejects with first worker error', async () => {
    const error = new Error('fail');
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw error;
        return item;
      }),
    ).rejects.toThrow('fail');
  });

  it('waits for launched workers to finish before rejecting', async () => {
    const completed: number[] = [];
    const error = new Error('fail');

    await expect(
      mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
        if (item === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, (4 - item) * 20));
        completed.push(item);
        return item;
      }),
    ).rejects.toThrow('fail');

    expect(completed).toEqual([1]);
  });

  it('does not mutate input', async () => {
    const input = [1, 2, 3];
    await mapWithConcurrency(input, 2, async (item) => item);
    expect(input).toEqual([1, 2, 3]);
  });

  it('limit 1 does not resolve while queued work remains', async () => {
    const barriers = [
      createBarrier(),
      createBarrier(),
      createBarrier(),
    ];

    const promise = mapWithConcurrency([1, 2, 3], 1, async (item) => {
      await barriers[item - 1].promise;
      return item * 10;
    });

    barriers[0].resolve();
    await expect(timeoutPromise(promise, 20)).rejects.toThrow('timeout');

    barriers[1].resolve();
    await expect(timeoutPromise(promise, 20)).rejects.toThrow('timeout');

    barriers[2].resolve();
    await expect(promise).resolves.toEqual([10, 20, 30]);
  });

  it('temporary gap does not resolve while replacement work remains', async () => {
    const barriers = [
      createBarrier(),
      createBarrier(),
      createBarrier(),
    ];

    const promise = mapWithConcurrency([1, 2, 3], 2, async (item) => {
      await barriers[item - 1].promise;
      return item;
    });

    barriers[0].resolve();
    await expect(timeoutPromise(promise, 20)).rejects.toThrow('timeout');

    barriers[2].resolve();
    await expect(timeoutPromise(promise, 20)).rejects.toThrow('timeout');

    barriers[1].resolve();
    await expect(promise).resolves.toEqual([1, 2, 3]);
  });

  it('does not start queued items after first failure', async () => {
    const error = new Error('fail');
    const started: number[] = [];
    const completed: number[] = [];
    const release = createBarrier();

    const promise = mapWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      started.push(item);
      if (item === 2) throw error;
      await release.promise;
      completed.push(item);
      return item;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(new Set(started)).toEqual(new Set([1, 2]));
    release.resolve();

    await expect(promise).rejects.toThrow('fail');
    expect(new Set(started)).toEqual(new Set([1, 2]));
    expect(completed).toEqual([1]);
  });

  it('preserves first error identity when multiple workers reject', async () => {
    const errorA = new Error('first');
    const errorB = new Error('second');
    const started: number[] = [];
    const barrier1 = createBarrier();
    const barrier2 = createBarrier();

    const promise = mapWithConcurrency([1, 2, 3], 2, async (item) => {
      started.push(item);
      if (item === 1) {
        await barrier1.promise;
        throw errorA;
      }
      if (item === 2) {
        await barrier2.promise;
        throw errorB;
      }
      return item;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(new Set(started)).toEqual(new Set([1, 2]));
    barrier1.resolve();
    await new Promise((r) => setTimeout(r, 20));
    expect(new Set(started)).toEqual(new Set([1, 2]));
    barrier2.resolve();

    let caught: unknown = 'none';
    try {
      await promise;
    } catch (err) {
      caught = err;
    }

    expect(caught).toBe(errorA);
    expect(new Set(started)).toEqual(new Set([1, 2]));
  });

  it('recognizes throw undefined as a failure', async () => {
    const errorB = new Error('second');
    const started: number[] = [];
    const barrier1 = createBarrier();
    const barrier2 = createBarrier();

    const promise = mapWithConcurrency([1, 2, 3], 2, async (item) => {
      started.push(item);
      if (item === 1) {
        await barrier1.promise;
        throw undefined;
      }
      if (item === 2) {
        await barrier2.promise;
        throw errorB;
      }
      return item;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(new Set(started)).toEqual(new Set([1, 2]));
    barrier1.resolve();
    await new Promise((r) => setTimeout(r, 20));
    expect(new Set(started)).toEqual(new Set([1, 2]));
    barrier2.resolve();

    let rejected = false;
    let rejectionValue: unknown = 'sentinel';
    try {
      await promise;
    } catch (err) {
      rejected = true;
      rejectionValue = err;
    }

    expect(rejected).toBe(true);
    expect(rejectionValue).toBeUndefined();
    expect(new Set(started)).toEqual(new Set([1, 2]));
  });
});

function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

function createBarrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
