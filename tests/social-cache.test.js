import { jest } from '@jest/globals';

const getFollowings = jest.fn();
const getFollowers = jest.fn();
const getMe = jest.fn();

jest.unstable_mockModule('../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { getFollowings, getFollowers, getMe },
}));

const { getCachedUserPayload, invalidateUserNamespaces, __resetCacheCoordinationForTests } =
  await import('../server/lib/social-cache.js');
const { requestCache } = await import('../server/lib/request-cache.js');
const { deferred } = await import('./helpers/deferred.js');

beforeEach(async () => {
  // This suite populates the same module-scope in-flight map the tiering
  // suite does; without the reset a gate left open here leaks into the next
  // test that asks for the same (user, resource).
  await __resetCacheCoordinationForTests();
  requestCache.invalidateUser('u1');
  getFollowings.mockClear();
});

describe('getCachedUserPayload', () => {
  test('a warm entry is served without calling the loader', async () => {
    const load = jest.fn().mockResolvedValue({ collection: [1] });
    await getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    await getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test('concurrent misses share ONE load instead of each running the crawl', async () => {
    // The cold-load case: the dashboard and a tool page ask for the same
    // resource within milliseconds. Before coalescing, both ran a full crawl.
    const gate = deferred();
    const load = jest.fn(() => gate.promise);

    const a = getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    const b = getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    const c = getCachedUserPayload('likes', 'u1', 'default', load, 60_000);

    expect(load).toHaveBeenCalledTimes(1);
    gate.resolve({ collection: [1, 2] });
    expect(await a).toEqual({ collection: [1, 2] });
    expect(await b).toEqual({ collection: [1, 2] });
    expect(await c).toEqual({ collection: [1, 2] });
  });

  test('a failed load does not wedge later attempts', async () => {
    const load = jest.fn()
      .mockRejectedValueOnce(new Error('sc down'))
      .mockResolvedValueOnce({ collection: [7] });

    await expect(getCachedUserPayload('likes', 'u1', 'default', load, 60_000))
      .rejects.toThrow('sc down');
    await expect(getCachedUserPayload('likes', 'u1', 'default', load, 60_000))
      .resolves.toEqual({ collection: [7] });
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('invalidating mid-flight does not let stale data repopulate the cache', async () => {
    // The race behind "I unliked a track and it came back": a crawl that
    // started before the mutation must not write its pre-mutation snapshot.
    const gate = deferred();
    const load = jest.fn(() => gate.promise);

    const inflight = getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    invalidateUserNamespaces('u1', ['likes']);   // e.g. bulk-unlike lands here
    gate.resolve({ collection: ['stale'] });
    await inflight;                              // still resolves for its awaiter

    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();

    // The next read re-fetches rather than serving the stale snapshot.
    const fresh = jest.fn().mockResolvedValue({ collection: ['fresh'] });
    await expect(getCachedUserPayload('likes', 'u1', 'default', fresh, 60_000))
      .resolves.toEqual({ collection: ['fresh'] });
  });

  test('different users never share an in-flight load', async () => {
    const gate = deferred();
    const load = jest.fn(() => gate.promise);
    getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    getCachedUserPayload('likes', 'u2', 'default', load, 60_000);
    expect(load).toHaveBeenCalledTimes(2);
    gate.resolve({ collection: [] });
    requestCache.invalidateUser('u2');
  });
});

/**
 * The reset has to leave the caches empty, not merely attempt to.
 *
 * This is the invariant every suite's `beforeEach` depends on, and it is the
 * one that broke: a load still in flight when the reset runs resolves a moment
 * later and writes its collection into `requestCache`. If the reset clears the
 * payload cache before draining that work — or if a suite clears it itself
 * beforehand — the write lands *after* the wipe and the next test is served a
 * collection it never stubbed. Nothing fails at that point; the failure
 * surfaces later, in a different file, as an assertion about the wrong
 * fixture, roughly one full run in thirty.
 *
 * So the assertion is deliberately made under the conditions that broke it:
 * work genuinely in flight, released only after the reset has returned.
 */
describe('__resetCacheCoordinationForTests', () => {
  test('a load still in flight cannot repopulate the cache after the reset', async () => {
    const gate = deferred();
    const load = jest.fn(() => gate.promise);

    // In flight, and deliberately not awaited: this is the leftover a previous
    // test hands to the next one.
    const inflight = getCachedUserPayload('likes', 'u1', 'default', load, 60_000);
    expect(load).toHaveBeenCalledTimes(1);

    // Release it only once the reset has already drained and wiped, so the
    // continuation that writes to the cache runs strictly afterwards — the
    // worst case, not the convenient one.
    const reset = __resetCacheCoordinationForTests({ settleMs: 5 });
    gate.resolve({ collection: ['stale'] });
    await reset;
    await inflight.catch(() => {});
    // One more turn, so any continuation scheduled behind the resolve has run.
    await new Promise((r) => setImmediate(r));

    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
  });

  test('it wipes entries any earlier test left behind, for every user', async () => {
    requestCache.set('likes', 'u1', 'default', { collection: [1] }, 60_000);
    requestCache.set('playlists', 'u2', 'default', { collection: [2] }, 60_000);

    await __resetCacheCoordinationForTests();

    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
    expect(requestCache.get('playlists', 'u2', 'default')).toBeUndefined();
    expect(requestCache.size()).toBe(0);
  });
});
