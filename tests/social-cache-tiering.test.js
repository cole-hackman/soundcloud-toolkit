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

const { loadUserCollection, invalidateUserCollections, invalidatePlaylistState, __resetCacheCoordinationForTests } =
  await import('../server/lib/social-cache.js');
const { requestCache } = await import('../server/lib/request-cache.js');

const req = { user: { id: 'u1' } };
const shape = (items) => ({ collection: items, total: items.length });
const flush = () => new Promise((r) => setImmediate(r));

/** A promise plus its resolver, so a test can hold a crawl open and land a
 *  mutation while it is still in flight. */
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

beforeEach(() => {
  __resetCacheCoordinationForTests();
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

  /* ── Regression: a crawl must never publish pre-mutation data ──────────
   * These four cover the ways an in-flight crawl could republish a snapshot
   * the user had already invalidated. The original in-flight guard only
   * covered the in-memory write, so all four slipped past a green suite.
   */

  test('a crawl invalidated mid-flight does NOT persist to the snapshot tier', async () => {
    readSnapshot.mockResolvedValue(null);
    const gate = deferred();
    const crawl = jest.fn(() => gate.promise);

    const inflight = loadUserCollection(req, 'likes', crawl, shape);
    // The crawl must actually be RUNNING before the mutation lands — that is
    // the hazard. (Invalidating first is a different, benign case: a crawl
    // started after the mutation is fetching post-mutation data and should
    // persist.)
    await flush();
    expect(crawl).toHaveBeenCalledTimes(1);

    invalidateUserCollections('u1', ['likes']);   // e.g. bulk-unlike lands here
    gate.resolve([{ id: 'stale' }]);
    await inflight;
    await flush();

    // Durable, and survives a restart — so republishing here is worse than the
    // in-memory case the earlier guard already covered.
    expect(writeSnapshot).not.toHaveBeenCalled();
    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
  });

  test('a background revalidate invalidated mid-crawl publishes to neither tier', async () => {
    readSnapshot.mockResolvedValue({
      items: [{ id: 'old' }], complete: true, stale: true, truncated: false,
      syncedAt: new Date(Date.now() - 3_600_000), totalItems: 1,
    });
    const gate = deferred();
    const crawl = jest.fn(() => gate.promise);

    await loadUserCollection(req, 'likes', crawl, shape);   // serves stale, starts refresh
    invalidateUserCollections('u1', ['likes']);
    gate.resolve([{ id: 'pre-mutation' }]);
    await flush();

    // This path is not in the in-flight registry at all, so only the
    // invalidation mark can stop it.
    expect(writeSnapshot).not.toHaveBeenCalled();
    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
  });

  test('a snapshot synced before the last mutation is not served, even if the row still says complete', async () => {
    // invalidateSnapshot's UPDATE is a network round trip and is not awaited.
    // Until it commits the row still reads 'complete', so the reader needs a
    // synchronous way to know the data predates a mutation it just made.
    invalidateUserCollections('u1', ['likes']);
    readSnapshot.mockResolvedValue({
      items: [{ id: 'pre-mutation' }], complete: true, stale: false, truncated: false,
      syncedAt: new Date(Date.now() - 60_000),      // synced BEFORE the invalidation
      totalItems: 1,
    });
    const crawl = jest.fn().mockResolvedValue([{ id: 'fresh' }]);

    const payload = await loadUserCollection(req, 'likes', crawl, shape);

    expect(crawl).toHaveBeenCalledTimes(1);
    expect(payload.collection).toEqual([{ id: 'fresh' }]);
  });

  test('a snapshot synced AFTER the last mutation is still served', async () => {
    // The guard must not make every post-mutation read a cold crawl forever.
    invalidateUserCollections('u1', ['likes']);
    readSnapshot.mockResolvedValue({
      items: [{ id: 'post-mutation' }], complete: true, stale: false, truncated: false,
      syncedAt: new Date(Date.now() + 1000),        // synced AFTER the invalidation
      totalItems: 1,
    });
    const crawl = jest.fn();

    const payload = await loadUserCollection(req, 'likes', crawl, shape);

    expect(crawl).not.toHaveBeenCalled();
    expect(payload.collection).toEqual([{ id: 'post-mutation' }]);
  });

  test('a playlist mutation invalidates the snapshot tier, not just memory', async () => {
    // GET /api/playlists reads through the snapshot now, so clearing only the
    // memo left a 'complete' Postgres row serving the pre-mutation list for its
    // full TTL — a deleted playlist kept rendering and 404'd when opened.
    invalidatePlaylistState('u1');
    expect(invalidateSnapshot).toHaveBeenCalledWith('u1', ['playlists']);

    readSnapshot.mockResolvedValue({
      items: [{ id: 'deleted-playlist' }], complete: true, stale: false, truncated: false,
      syncedAt: new Date(Date.now() - 60_000), totalItems: 1,
    });
    const crawl = jest.fn().mockResolvedValue([{ id: 'fresh' }]);
    const payload = await loadUserCollection(req, 'playlists', crawl, shape);

    expect(crawl).toHaveBeenCalledTimes(1);
    expect(payload.collection).toEqual([{ id: 'fresh' }]);
  });

  /* ── Regression: invalidation must beat the WRITE, not just the crawl ───
   * The four above all check the mark before the write starts. That is not
   * enough on its own: `Date.now()` can hand two mutations the same mark, and
   * `writeSnapshot` is a transaction round trip that a mutation can land in
   * the middle of. Both let a stale snapshot end up marked 'complete'.
   */

  test('two invalidations inside ONE millisecond are still distinguishable', async () => {
    // The mark used to be Date.now(). Under a frozen clock the second
    // invalidation produced the SAME mark as the first, so a crawl that
    // started between them compared equal and published pre-mutation data.
    // A strictly increasing revision cannot collide that way.
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      readSnapshot.mockResolvedValue(null);
      invalidateUserCollections('u1', ['likes']);          // mutation 1

      const gate = deferred();
      const crawl = jest.fn(() => gate.promise);
      const inflight = loadUserCollection(req, 'likes', crawl, shape);
      await flush();
      expect(crawl).toHaveBeenCalledTimes(1);              // crawl is RUNNING

      invalidateUserCollections('u1', ['likes']);          // mutation 2, same ms
      gate.resolve([{ id: 'pre-mutation' }]);
      await inflight;
      await flush();

      expect(writeSnapshot).not.toHaveBeenCalled();
      expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
    } finally {
      nowSpy.mockRestore();
    }
  });

  test('a mutation landing DURING the snapshot write re-marks it stale', async () => {
    // invalidateSnapshot marks the old row stale, then this older writer's
    // transaction commits and upserts it back to 'complete' with a fresh
    // syncedAt — which also defeats the reader's syncedAt guard, because that
    // timestamp records the write, not the fetch. The writer has to notice.
    readSnapshot.mockResolvedValue(null);
    const write = deferred();
    writeSnapshot.mockImplementationOnce(() => write.promise);

    await loadUserCollection(req, 'likes', () => Promise.resolve([{ id: 1 }]), shape);
    expect(writeSnapshot).toHaveBeenCalledTimes(1);
    expect(invalidateSnapshot).not.toHaveBeenCalled();

    invalidateUserCollections('u1', ['likes']);            // lands mid-write
    expect(invalidateSnapshot).toHaveBeenCalledTimes(1);   // the mutation's own

    write.resolve({ pages: 1, items: 1 });
    await flush();

    // The writer re-invalidates after its commit, so the row does not survive
    // as 'complete'. Worst case is a needless re-crawl; never a served stale.
    expect(invalidateSnapshot).toHaveBeenCalledTimes(2);
    expect(invalidateSnapshot).toHaveBeenLastCalledWith('u1', ['likes']);
  });

  test('a background revalidate raced mid-write publishes to neither tier', async () => {
    readSnapshot.mockResolvedValue({
      items: [{ id: 'old' }], complete: true, stale: true, truncated: false,
      syncedAt: new Date(Date.now() - 3_600_000), totalItems: 1,
    });
    const gate = deferred();
    const write = deferred();
    writeSnapshot.mockImplementationOnce(() => write.promise);

    await loadUserCollection(req, 'likes', () => gate.promise, shape);
    gate.resolve([{ id: 'pre-mutation' }]);
    await flush();
    expect(writeSnapshot).toHaveBeenCalledTimes(1);        // write is in flight

    invalidateUserCollections('u1', ['likes']);
    write.resolve({ pages: 1, items: 1 });
    await flush();

    expect(invalidateSnapshot).toHaveBeenCalledTimes(2);   // mutation + writer
    expect(requestCache.get('likes', 'u1', 'default')).toBeUndefined();
  });

  test('an unknown resource is rejected rather than silently cached', async () => {
    await expect(loadUserCollection(req, 'bananas', jest.fn(), shape))
      .rejects.toThrow(/Unknown snapshot resource/);
  });
});
