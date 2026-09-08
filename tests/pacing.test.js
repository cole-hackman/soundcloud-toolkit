const {
  sleep,
  SC_WRITE_PACING_MS,
  SC_PLAYLIST_PACING_MS,
  SC_BULK_PACING_MS,
  SC_READ_CONCURRENCY,
  mapWithConcurrency,
} = await import('../server/lib/pacing.js');

test('sleep resolves after roughly the requested delay', async () => {
  const start = Date.now();
  await sleep(20);
  expect(Date.now() - start).toBeGreaterThanOrEqual(15);
});

test('standard SoundCloud write pacing is 300ms', () => {
  expect(SC_WRITE_PACING_MS).toBe(300);
});

test('the named pacing constants match the values they replaced', () => {
  // These were literal sleep(500) x9 and sleep(150) x1 in routes/api.js.
  expect(SC_PLAYLIST_PACING_MS).toBe(500);
  expect(SC_BULK_PACING_MS).toBe(150);
});

describe('mapWithConcurrency', () => {
  test('returns results in input order regardless of completion order', async () => {
    const items = [40, 5, 30, 10, 1];
    const out = await mapWithConcurrency(items, 3, async (ms) => {
      await sleep(ms);
      return ms;
    });
    expect(out).toEqual(items);
  });

  test('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(5);
      inFlight -= 1;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1); // actually concurrent, not accidentally serial
  });

  test('visits every item exactly once', async () => {
    const seen = [];
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => { seen.push(n); });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('a rejection propagates to the caller', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });

  test('per-item failures can be captured without aborting the batch', async () => {
    // The pattern the bulk routes use: return a result object, never throw.
    const out = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      try {
        if (n === 2) throw new Error('nope');
        return { n, status: 'ok' };
      } catch (e) {
        return { n, status: 'error', error: e.message };
      }
    });
    expect(out).toEqual([
      { n: 1, status: 'ok' },
      { n: 2, status: 'error', error: 'nope' },
      { n: 3, status: 'ok' },
    ]);
  });

  test('handles empty and non-array input', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    expect(await mapWithConcurrency(null, 4, async () => 1)).toEqual([]);
  });

  test('clamps a nonsense limit to at least one worker', async () => {
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n * 2)).toEqual([2, 4]);
    expect(await mapWithConcurrency([1, 2], -5, async (n) => n * 2)).toEqual([2, 4]);
  });

  test('read concurrency is bounded — the point is not to burst', () => {
    expect(SC_READ_CONCURRENCY).toBeGreaterThan(1);
    expect(SC_READ_CONCURRENCY).toBeLessThanOrEqual(8);
  });
});
