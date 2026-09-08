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

/**
 * When each (user, resource) was last invalidated: `{ rev, at }`.
 *
 * `cancelInFlight` only reaches loads registered in `inFlightLoads`, and only
 * guards the in-memory write. That left three ways for a crawl that started
 * before a mutation to publish its pre-mutation snapshot afterwards: the
 * persistent write in loadUserCollection's tier 3, the background revalidate
 * (which is not in `inFlightLoads` at all), and a read racing the not-yet-
 * committed `status='stale'` UPDATE.
 *
 * A monotonic mark closes all three, and does it SYNCHRONOUSLY — no waiting on
 * the database. A crawl records the mark when it starts and refuses to publish
 * if the mark has moved; a reader refuses a snapshot older than the mark.
 *
 * Two different values, because the two comparisons want different things:
 *
 *   - `rev` is a process-wide counter that strictly increases on EVERY
 *     invalidation. `Date.now()` does not: two mutations inside the same
 *     millisecond produce the same timestamp, so a crawl that started between
 *     them would compare equal to the later one and publish pre-mutation data.
 *     Equality against a counter cannot collide that way.
 *   - `at` is the wall clock, and is only ever compared against a `syncedAt`
 *     that Postgres wrote. A counter is meaningless in that comparison.
 */
let invalidationRev = 0;
const invalidatedAt = new Map();

const markKey = (userId, resource) => `${resource}::${userId}`;

/** Monotonic revision of the last invalidation; 0 when never invalidated. */
export function invalidationMark(userId, resource) {
  return invalidatedAt.get(markKey(userId, resource))?.rev ?? 0;
}

/** Wall-clock time of the last invalidation, for comparing against a stored
 *  `syncedAt`; 0 when never invalidated. */
export function invalidationTime(userId, resource) {
  return invalidatedAt.get(markKey(userId, resource))?.at ?? 0;
}

function recordInvalidation(userId, resources) {
  const at = Date.now();
  for (const resource of resources) {
    invalidatedAt.set(markKey(userId, resource), { rev: ++invalidationRev, at });
  }
}

/** True when nothing has invalidated this resource since `mark` was taken. */
function stillCurrent(userId, resource, mark) {
  return invalidationMark(userId, resource) === mark;
}

/**
 * Persist a crawl, then make sure a mutation did not race the write.
 *
 * Checking the mark BEFORE the write cannot make the write atomic with
 * invalidation: `writeSnapshot` is a transaction round trip, and a mutation
 * landing during it runs `invalidateSnapshot` against the row this writer is
 * about to overwrite. The mutation marks it `stale`; this (older) writer then
 * upserts it back to `complete` with a FRESH `syncedAt` — which also defeats
 * the reader's `syncedAt <= invalidated` guard, because that timestamp records
 * when the row was written, not when the items were fetched.
 *
 * Re-checking afterwards and re-invalidating converges: any writer that finds
 * the mark moved leaves the row stale, so the next read re-crawls. The failure
 * direction is a needless crawl, never a served-stale snapshot.
 *
 * @returns {Promise<boolean>} true when the snapshot was published and is current
 */
async function publishSnapshot(userId, resource, items, mark, { truncated }) {
  await writeSnapshot(userId, resource, items, { truncated });
  if (stillCurrent(userId, resource, mark)) return true;
  logger.info('[snapshot-cache] invalidated during snapshot write; re-marking stale', { resource });
  await invalidateSnapshot(userId, [resource]);
  return false;
}

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
  // Recorded first and synchronously: everything downstream — the in-flight
  // guard, the background revalidate, and the snapshot reader — decides what
  // it may publish by comparing against this mark.
  recordInvalidation(userId, namespaces);
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

/**
 * Every playlist the user owns, fully paginated by cursor and cached across
 * both tiers.
 *
 * The paged tools (library audit, keyword search) slice this list rather than
 * asking SoundCloud for an offset page: `/me/playlists` declares only
 * `show_tracks`, `linked_partitioning` and `limit`, and the shared `offset`
 * parameter is marked deprecated — an ignored offset silently returns page one
 * while the UI claims to be showing playlists 21-40. Cursor pagination has no
 * such ambiguity, and the crawl is already cached for GET /api/playlists.
 */
export function loadCachedPlaylists(req) {
  return loadUserCollection(
    req,
    'playlists',
    () => soundcloudClient.getAllPlaylists(req.accessToken, req.refreshToken),
    (playlists) => {
      // Cover art is derived from what the list response already carries.
      // This used to fall back to getPlaylistWithTracks for every artwork-less
      // playlist, in an unbounded Promise.all — 50 simultaneous requests each
      // returning up to 500 full track objects, to read one artwork_url off
      // tracks[0]. That fan-out was the dominant cost of this endpoint and its
      // swallowed errors turned the resulting 429s into silently missing
      // covers. Clients that want a real per-playlist cover can ask for one
      // lazily; the owner avatar is a fine placeholder in a list view.
      const collection = playlists.map((p) => {
        const idNum = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
        const coverUrl = p.artwork_url || p.user?.avatar_url || '';
        return { ...p, id: idNum, coverUrl };
      });
      return { collection, total: collection.length };
    },
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

/**
 * Invalidate after a playlist mutation.
 *
 * MUST clear both tiers. GET /api/playlists reads through the snapshot now, so
 * clearing only memory left a 'complete' Postgres snapshot in place for its
 * full TTL: a deleted playlist kept rendering (and 404'd when opened), and a
 * newly merged one was missing from the list that the merge itself redirects to.
 */
export function invalidatePlaylistState(userId) {
  invalidateUserCollections(userId, ['playlists']);
}

/* ── Read-through across both cache tiers ───────────────────────────────── */

/** Background refreshes in flight, so a stale-while-revalidate burst does not
 *  start one crawl per request. */
const revalidating = new Map();

function revalidateInBackground(userId, resource, crawl, shape) {
  const key = `${resource}::${userId}`;
  if (revalidating.has(key)) return;

  // Taken before the crawl starts: if a mutation lands while it runs, this
  // refresh is carrying pre-mutation data and must publish nothing. This path
  // is deliberately NOT in `inFlightLoads`, so cancelInFlight cannot reach it —
  // the mark is what protects it.
  const mark = invalidationMark(userId, resource);

  const done = Promise.resolve()
    .then(async () => {
      const items = await crawl();
      if (!stillCurrent(userId, resource, mark)) {
        logger.info('[snapshot-cache] discarding background revalidate; invalidated mid-crawl', { resource });
        return;
      }
      const truncated = items?.truncated === true;
      // Publishes and then re-checks: writeSnapshot is a round trip, and a
      // mutation can land during it. Losing the memo write is harmless;
      // leaving a stale snapshot marked 'complete' is not.
      if (!(await publishSnapshot(userId, resource, items, mark, { truncated }))) return;
      // Same payload shape as the other tiers — a bare shape(items) here would
      // silently drop `truncated` after any background refresh.
      requestCache.set(
        resource, userId, 'default',
        { ...shape(items), truncated },
        CACHE_TTL[resource] ?? 60_000,
      );
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

  // Tier 2: Postgres. Two different things are called "stale" here, and only
  // one of them still serves:
  //   - TTL-stale (snapshot.stale): served immediately, refreshed behind the
  //     response. An answer now beats a correct answer after a 25-page crawl.
  //   - invalidated (the user mutated this): NOT served. readSnapshot already
  //     refuses a row whose status is no longer 'complete', and the mark check
  //     below covers the window before that UPDATE commits.
  const snapshot = await readSnapshot(userId, resource);
  // A snapshot synced before the last invalidation is pre-mutation data, even
  // if its row still says 'complete'. This is the synchronous guard that makes
  // invalidateSnapshot's fire-and-forget UPDATE safe: the read does not have to
  // wait for that write to commit.
  const invalidated = invalidationTime(userId, resource);
  const supersededByMutation = snapshot
    && invalidated > 0
    && snapshot.syncedAt instanceof Date
    && snapshot.syncedAt.getTime() <= invalidated;

  if (snapshot && !supersededByMutation) {
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
  // Taken before the crawl: getCachedUserPayload's own `stale` flag guards only
  // the in-memory write, so without this the persistent write below would
  // republish pre-mutation data — and, being durable, it would survive the
  // restart that used to clear it.
  const mark = invalidationMark(userId, resource);

  return getCachedUserPayload(resource, userId, 'default', async () => {
    const items = await crawl();
    const payload = { ...shape(items), truncated: items?.truncated === true };
    if (!stillCurrent(userId, resource, mark)) {
      logger.info('[snapshot-cache] not persisting crawl; invalidated mid-flight', { resource });
      return payload;
    }
    // Fire-and-forget, deliberately NOT awaited. Persisting a 20,000-item
    // library is ~100 INSERTs in one transaction; making the response wait on
    // that would hand the cold path a fresh delay in exchange for removing a
    // future one. The caller already has its data — the snapshot is for the
    // NEXT reader. Same posture as harvestTracks.
    Promise.resolve(publishSnapshot(userId, resource, items, mark, {
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

/**
 * Drop all in-process cache coordination state: in-flight loads, background
 * revalidations, and invalidation marks.
 *
 * For tests. These live at module scope for the lifetime of the process, so
 * without this one test's leftover in-flight entry is handed to the next test
 * that asks for the same (user, resource) — which is exactly how the races
 * below went unnoticed. Mirrors clearAuthCache in auth-cache.js.
 */
export function __resetCacheCoordinationForTests() {
  inFlightLoads.clear();
  revalidating.clear();
  invalidatedAt.clear();
}
