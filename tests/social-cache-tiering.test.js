import { jest } from '@jest/globals';

const readSnapshot = jest.fn();
const writeSnapshot = jest.fn().mockResolvedValue({ pages: 1, items: 1 });
const invalidateSnapshot = jest.fn().mockResolvedValue({ count: 1 });

jest.unstable_mockModule('../server/lib/snapshot-cache.js', () => ({
  readSnapshot,
  writeSnapshot,
  invalidateSnapshot,
  SNAPSHOT_RESOURCES: ['likes', 'playlists', 'followings', 'followers', 'reposts'],
}));
jest.unstable_mockModule('../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: {},
}));

const { loadUserCollection, invalidateUserCollections } =
  await import('../server/lib/social-cache.js');
const { requestCache } = await import('../server/lib/request-cache.js');

const req = { user: { id: 'u1' } };
const shape = (items) => ({ collection: items, total: items.length });
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  requestCache.invalidateUser('u1');
  readSnapshot.mockReset();
  writeSnapshot.mockClear();
  invalidateSnapshot.mockClear();
});

describe('memory -> Postgres -> SoundCloud tiering', () => {
  test('a fresh snapshot is served without touching SoundCloud', async () => {
    readSnapshot.mockResolvedValue({
      items: [{ id: 1 }], complete: true, stale: false, truncated: false,
      syncedAt: new Date(), totalItems: 1,
    });
    const crawl = jest.fn();

    const payload = await loadUserCollection(req, 'likes', crawl, shape);

    expect(crawl).not.toHaveBeenCalled();
    expect(payload.collection).toEqual([{ id: 1 }]);
    expect(payload.stale).toBe(false);
  });

  test('a cold read crawls and persists the result for the next process', async () => {
    readSnapshot.mockResolvedValue(null);
    const crawl = jest.fn().mockResolvedValue([{ id: 7 }]);

    const payload = await loadUserCollection(req, 'likes', crawl, shape);

    expect(crawl).toHaveBeenCalledTimes(1);
    expect(payload.collection).toEqual([{ id: 7 }]);
    expect(writeSnapshot).toHaveBeenCalledWith('u1', 'likes', [{ id: 7 }], { truncated: false });
  });

  test('a stale snapshot is served immediately and refreshed behind the response', async () => {
    // This is the whole point of the tier: the user gets an answer now, not
    // after a 25-page crawl, and the crawl still happens.
    readSnapshot.mockResolvedValue({
      items: [{ id: 'old' }], complete: true, stale: true, truncated: false,
      syncedAt: new Date(Date.now() - 3_600_000), totalItems: 1,
    });
    const crawl = jest.fn().mockResolvedValue([{ id: 'new' }]);

    const payload = await loadUserCollection(req, 'likes', crawl, shape);

    expect(payload.collection).toEqual([{ id: 'old' }]);  // served instantly
    expect(payload.stale).toBe(true);                      // and says so

    await flush();
    expect(crawl).toHaveBeenCalledTimes(1);
    expect(writeSnapshot).toHaveBeenCalledWith('u1', 'likes', [{ id: 'new' }], { truncated: false });
  });

  test('concurrent stale reads trigger ONE background refresh, not one each', async () => {
    readSnapshot.mockResolvedValue({
      items: [{ id: 'old' }], complete: true, stale: true, truncated: false,
      syncedAt: new Date(0), totalItems: 1,
    });
    let resolveCrawl;
    const crawl = jest.fn(() => new Promise((r) => { resolveCrawl = r; }));

    await loadUserCollection(req, 'likes', crawl, shape);
    requestCache.invalidateUser('u1'); // force the next call past the memo tier
    await loadUserCollection(req, 'likes', crawl, shape);

    expect(crawl).toHaveBeenCalledTimes(1);
    resolveCrawl([]);
    await flush();
  });

  test('a failing background refresh does not surface as a request error', async () => {
    readSnapshot.mockResolvedValue({
      items: [{ id: 'old' }], complete: true, stale: true, truncated: false,
      syncedAt: new Date(0), totalItems: 1,
    });
    const crawl = jest.fn().mockRejectedValue(new Error('soundcloud down'));

    await expect(loadUserCollection(req, 'likes', crawl, shape)).resolves.toBeDefined();
    await flush();
    expect(crawl).toHaveBeenCalled();
  });

  test('the response does not wait on the snapshot write', async () => {
    // Persisting a 20k-item library is ~100 INSERTs in one transaction.
    // Awaiting it would hand the cold path a fresh delay in exchange for
    // removing a future one, making this change a net regression.
    readSnapshot.mockResolvedValue(null);
    let settleWrite;
    writeSnapshot.mockImplementationOnce(() => new Promise((r) => { settleWrite = r; }));

    const payload = await loadUserCollection(
      req, 'likes', () => Promise.resolve([{ id: 1 }]), shape,
    );

    // Resolved while the write is still outstanding.
    expect(payload.collection).toEqual([{ id: 1 }]);
    expect(writeSnapshot).toHaveBeenCalledTimes(1);
    settleWrite({ pages: 1, items: 1 });
  });

  test('a failing snapshot write does not fail the request', async () => {
    readSnapshot.mockResolvedValue(null);
    writeSnapshot.mockRejectedValueOnce(new Error('disk full'));

    await expect(
      loadUserCollection(req, 'likes', () => Promise.resolve([{ id: 1 }]), shape),
    ).resolves.toMatchObject({ collection: [{ id: 1 }] });
    await flush();
  });

  test('a truncated crawl is reported as truncated, not as a whole library', async () => {
    readSnapshot.mockResolvedValue(null);
    const items = [{ id: 1 }];
    Object.defineProperty(items, 'truncated', { value: true, enumerable: false });

    const payload = await loadUserCollection(req, 'likes', () => Promise.resolve(items), shape);

    expect(payload.truncated).toBe(true);
    expect(writeSnapshot).toHaveBeenCalledWith('u1', 'likes', items, { truncated: true });
  });

  test('invalidation clears the memo tier and marks the snapshot stale', async () => {
    readSnapshot.mockResolvedValue(null);
    await loadUserCollection(req, 'likes', () => Promise.resolve([{ id: 1 }]), shape);
    expect(requestCache.get('likes', 'u1', 'default')).toBeDefined();

    invalidateUserCollections('u1', ['likes']);

    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
    expect(invalidateSnapshot).toHaveBeenCalledWith('u1', ['likes']);
  });

  test('an unknown resource is rejected rather than silently cached', async () => {
    await expect(loadUserCollection(req, 'bananas', jest.fn(), shape))
      .rejects.toThrow(/Unknown snapshot resource/);
  });
});
