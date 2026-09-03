/**
 * Per-user request-scoped caches for the authenticated user's SoundCloud
 * social/library payloads. Shared by the core API routes and the growth
 * suite so whichever runs first warms the cache for the other.
 */
import { requestCache } from './request-cache.js';
import { soundcloudClient } from './soundcloud-client.js';
import logger from './logger.js';
import {
  readSnapshot,
  writeSnapshot,
  invalidateSnapshot,
  SNAPSHOT_RESOURCES,
} from './snapshot-cache.js';

export const CACHE_TTL = {
  me: 60 * 1000,
  playlists: 5 * 60 * 1000,
  followings: 5 * 60 * 1000,
  followers: 5 * 60 * 1000,
  likes: 60 * 1000,
  reposts: 60 * 1000,
  activities: 60 * 1000,
};

/**
 * In-flight loads, keyed the same way as the cache itself.
 *
 * Without this, the cache only dedupes work that has already FINISHED: two
 * requests arriving while a full-library crawl is in progress both miss, and
 * both run the crawl. That is the common case on a cold page load, where the
 * dashboard and the tool page ask for the same resource within milliseconds.
 * Same shape as inFlightRefreshes in soundcloud-client.js.
 */
const inFlightLoads = new Map();

export function getCachedUserPayload(namespace, userId, key, load, ttlMs) {
  const cached = requestCache.get(namespace, userId, key);
  if (cached !== undefined) return Promise.resolve(cached);

  const flightKey = `${namespace}::${userId}::${key}`;
  const existing = inFlightLoads.get(flightKey);
  if (existing) return existing.promise;

  // A load that was already running when an invalidation happened is carrying
  // pre-invalidation data. It still resolves for whoever is awaiting it, but it
  // must not write that data into the cache — otherwise unliking a track and
  // then re-reading likes can resurrect it for a full TTL.
  const entry = { stale: false };
  // Invoked synchronously (not via .then) so the in-flight entry and the
  // underlying request start in the same tick — a deferred start would let a
  // caller in the same tick miss the coalescing window. The try/catch keeps a
  // synchronous throw from `load` behaving like a rejected promise.
  let started;
  try {
    started = Promise.resolve(load());
  } catch (err) {
    started = Promise.reject(err);
  }
  entry.promise = started
    .then((data) => {
      if (!entry.stale) requestCache.set(namespace, userId, key, data, ttlMs);
      return data;
    })
    .finally(() => {
      // Cleared on success AND failure, so one failed crawl does not wedge
      // every later attempt for this user.
      if (inFlightLoads.get(flightKey) === entry) inFlightLoads.delete(flightKey);
    });

  inFlightLoads.set(flightKey, entry);
  return entry.promise;
}

/** Mark any in-flight load under these namespaces as stale so it cannot
 *  repopulate the cache after an invalidation. */
function cancelInFlight(userId, namespaces) {
  const wanted = new Set(namespaces);
  for (const [flightKey, entry] of inFlightLoads) {
    const [namespace, entryUserId] = flightKey.split('::');
    if (entryUserId === String(userId) && wanted.has(namespace)) entry.stale = true;
  }
}

export function invalidateUserNamespaces(userId, namespaces) {
  cancelInFlight(userId, namespaces);
  namespaces.forEach((namespace) => {
    requestCache.invalidateNamespaceForUser(namespace, userId);
  });
}

/* Shared cached loaders for the auth user's social lists. The GET routes and
 * growth discovery use the same namespace/key/payload shape, so whichever
 * runs first warms the cache for the other. */
export function loadCachedFollowings(req) {
  return loadUserCollection(
    req,
    'followings',
    () => soundcloudClient.getFollowings(req.accessToken, req.refreshToken),
    (followings) => ({ collection: followings, total: followings.length }),
  );
}

export function loadCachedFollowers(req) {
  return loadUserCollection(
    req,
    'followers',
    () => soundcloudClient.getFollowers(req.accessToken, req.refreshToken),
    (followers) => ({ collection: followers, total: followers.length }),
  );
}

/** The authenticated user's own SoundCloud profile. Short TTL: it carries the
 * follower/like/playlist counters the dashboard renders, so it should not go
 * visibly stale, but /api/me and /api/dashboard/summary both want it on the
 * same page load and there is no reason to fetch it twice. */
export function loadCachedMe(req) {
  return getCachedUserPayload('me', req.user.id, 'default', () => (
    soundcloudClient.getMe(req.accessToken, req.refreshToken)
  ), CACHE_TTL.me);
}

export function invalidatePlaylistState(userId) {
  invalidateUserNamespaces(userId, ['playlists']);
}

/* ── Read-through across both cache tiers ───────────────────────────────── */

/** Background refreshes in flight, so a stale-while-revalidate burst does not
 *  start one crawl per request. */
const revalidating = new Map();

function revalidateInBackground(userId, resource, crawl, shape) {
  const key = `${resource}::${userId}`;
  if (revalidating.has(key)) return;

  const done = Promise.resolve()
    .then(async () => {
      const items = await crawl();
      await writeSnapshot(userId, resource, items, { truncated: items?.truncated === true });
      // Refresh the in-memory tier too, so the next request does not read a
      // payload older than the snapshot we just wrote.
      requestCache.set(resource, userId, 'default', shape(items), CACHE_TTL[resource] ?? 60_000);
    })
    .catch((error) => {
      // A failed refresh is not a user-visible error: the stale snapshot they
      // were already served remains valid until the next attempt.
      logger.warn('[snapshot-cache] background revalidate failed', {
        resource, error: error?.message,
      });
    })
    .finally(() => { revalidating.delete(key); });

  revalidating.set(key, done);
}

/**
 * Read a user collection through memory -> Postgres -> SoundCloud.
 *
 * `shape` turns the raw item array into the payload the route returns, and is
 * applied consistently at every tier so a cache hit and a cold crawl are
 * indistinguishable to the caller.
 *
 * @param {object}   req
 * @param {string}   resource  one of SNAPSHOT_RESOURCES
 * @param {Function} crawl     () => Promise<items[]>  (the SoundCloud crawl)
 * @param {Function} shape     (items) => payload
 */
export async function loadUserCollection(req, resource, crawl, shape) {
  if (!SNAPSHOT_RESOURCES.includes(resource)) {
    throw new Error(`Unknown snapshot resource: ${resource}`);
  }
  const userId = req.user.id;

  // Tier 1: in-memory.
  const memo = requestCache.get(resource, userId, 'default');
  if (memo !== undefined) return memo;

  // Tier 2: Postgres. Serve it even when stale, and refresh behind it — a
  // stale answer now beats a correct answer after a 25-page crawl.
  const snapshot = await readSnapshot(userId, resource);
  if (snapshot) {
    const payload = {
      ...shape(snapshot.items),
      cachedAt: snapshot.syncedAt,
      stale: snapshot.stale,
      truncated: snapshot.truncated,
    };
    requestCache.set(resource, userId, 'default', payload, CACHE_TTL[resource] ?? 60_000);
    if (snapshot.stale) revalidateInBackground(userId, resource, crawl, shape);
    return payload;
  }

  // Tier 3: SoundCloud. getCachedUserPayload provides the single-flight so
  // concurrent cold readers share one crawl.
  return getCachedUserPayload(resource, userId, 'default', async () => {
    const items = await crawl();
    const payload = { ...shape(items), truncated: items?.truncated === true };
    // Fire-and-forget, deliberately NOT awaited. Persisting a 20,000-item
    // library is ~100 INSERTs in one transaction; making the response wait on
    // that would hand the cold path a fresh delay in exchange for removing a
    // future one. The caller already has its data — the snapshot is for the
    // NEXT reader. Same posture as harvestTracks.
    Promise.resolve(writeSnapshot(userId, resource, items, {
      truncated: items?.truncated === true,
    })).catch(() => {});
    return payload;
  }, CACHE_TTL[resource] ?? 60_000);
}

/** Invalidate BOTH tiers. Every existing invalidateUserNamespaces call site
 *  gets the persistent tier for free by routing through here. */
export function invalidateUserCollections(userId, resources) {
  invalidateUserNamespaces(userId, resources);
  // Fire-and-forget: the in-memory tier is already clear, so a slow database
  // must not hold up the mutation response.
  invalidateSnapshot(userId, resources)?.catch?.(() => {});
}
