/**
 * Per-user request-scoped caches for the authenticated user's SoundCloud
 * social/library payloads. Shared by the core API routes and the growth
 * suite so whichever runs first warms the cache for the other.
 */
import { requestCache } from './request-cache.js';
import { soundcloudClient } from './soundcloud-client.js';

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
  return getCachedUserPayload('followings', req.user.id, 'default', async () => {
    const followings = await soundcloudClient.getFollowings(req.accessToken, req.refreshToken);
    return { collection: followings, total: followings.length, truncated: followings.truncated === true };
  }, CACHE_TTL.followings);
}

export function loadCachedFollowers(req) {
  return getCachedUserPayload('followers', req.user.id, 'default', async () => {
    const followers = await soundcloudClient.getFollowers(req.accessToken, req.refreshToken);
    return { collection: followers, total: followers.length, truncated: followers.truncated === true };
  }, CACHE_TTL.followers);
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
