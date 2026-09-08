import { jest } from '@jest/globals';

const getFollowings = jest.fn();
const getFollowers = jest.fn();
const getMe = jest.fn();

jest.unstable_mockModule('../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { getFollowings, getFollowers, getMe },
}));

const { getCachedUserPayload, invalidateUserNamespaces } =
  await import('../server/lib/social-cache.js');
const { requestCache } = await import('../server/lib/request-cache.js');

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
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
