import { jest } from '@jest/globals';

const {
  runWithTokenContext,
  getTokenContext,
  countScCall,
  getScCallCount,
  createScMetrics,
} = await import('../server/lib/token-context.js');

describe('SoundCloud round-trip counting', () => {
  test('counts calls made inside the request context', async () => {
    await new Promise((done) => {
      runWithTokenContext({ userId: 'u1' }, async () => {
        expect(getScCallCount()).toBe(0);
        countScCall();
        countScCall();
        expect(getScCallCount()).toBe(2);
        done();
      });
    });
  });

  test('counting survives async hops, which is how paginate accumulates', async () => {
    await new Promise((done) => {
      runWithTokenContext({ userId: 'u1' }, async () => {
        countScCall();
        await Promise.resolve();
        await new Promise((r) => setTimeout(r, 1));
        countScCall();
        expect(getScCallCount()).toBe(2);
        done();
      });
    });
  });

  test('a caller-owned bag is readable from OUTSIDE the context', async () => {
    // This is the case the request logger depends on: it registers its
    // 'finish' listener before authenticateUser establishes the context, so it
    // cannot read the store — it reads the bag it handed in.
    const metrics = createScMetrics();
    await new Promise((done) => {
      runWithTokenContext({ userId: 'u1', metrics }, async () => {
        countScCall();
        countScCall();
        countScCall();
        done();
      });
    });
    expect(metrics.scCalls).toBe(3);
    expect(getScCallCount()).toBe(0); // no ambient context out here
  });

  test('two concurrent requests do not share a counter', async () => {
    const a = createScMetrics();
    const b = createScMetrics();
    await Promise.all([
      new Promise((done) => runWithTokenContext({ userId: 'a', metrics: a }, async () => {
        countScCall();
        await new Promise((r) => setTimeout(r, 5));
        countScCall();
        done();
      })),
      new Promise((done) => runWithTokenContext({ userId: 'b', metrics: b }, async () => {
        countScCall();
        done();
      })),
    ]);
    expect(a.scCalls).toBe(2);
    expect(b.scCalls).toBe(1);
  });

  test('counting outside any request context is a no-op, not a crash', () => {
    expect(() => countScCall()).not.toThrow();
    expect(getScCallCount()).toBe(0);
    expect(getTokenContext()).toBeNull();
  });
});
