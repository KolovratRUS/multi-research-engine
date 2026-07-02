export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError('Concurrency limit must be a positive integer');
  }

  if (items.length === 0) {
    return [];
  }

  const results = new Array<{ value: R } | undefined>(items.length);
  let failed = false;
  let firstError: unknown;
  let nextIndex = 0;

  async function claimAndRun(): Promise<void> {
    while (true) {
      if (failed) return;

      const index = nextIndex;
      if (index >= items.length) break;
      nextIndex += 1;

      try {
        results[index] = { value: await worker(items[index], index) };
      } catch (err) {
        if (!failed) {
          failed = true;
          firstError = err;
        }
        return;
      }
    }
  }

  const workers = new Array<Promise<void>>(Math.min(limit, items.length));
  for (let i = 0; i < workers.length; i++) {
    workers[i] = claimAndRun();
  }

  await Promise.allSettled(workers);

  if (failed) {
    throw firstError;
  }

  const populated = new Array<R>(results.length);
  for (let i = 0; i < results.length; i++) {
    const slot = results[i];
    if (slot === undefined) {
      throw new Error('mapWithConcurrency: incomplete result array');
    }
    populated[i] = slot.value;
  }
  return populated;
}
