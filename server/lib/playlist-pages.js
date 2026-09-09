/**
 * One page of the user's playlists, each with its full track list.
 *
 * Shared by the two tools that need to walk a whole library a page at a time —
 * the library audit and the playlist keyword search. Both used to ask
 * SoundCloud for `/me/playlists?limit=&offset=`, but that endpoint's own spec
 * declares only `show_tracks`, `linked_partitioning` and `limit`, and marks the
 * shared `offset` parameter deprecated. An ignored offset returns page one
 * every time while the UI says "playlists 21-40", so the audit silently
 * re-audits the same twenty playlists forever.
 *
 * Slicing the cached, cursor-paginated full list has none of that ambiguity:
 * order is SoundCloud's own, the crawl is already cached for GET /api/playlists
 * (so a page walk costs one crawl, not one per page), and the total is known,
 * which is what makes an honest `hasMore` possible.
 */
import { soundcloudClient } from './soundcloud-client.js';
import { loadCachedPlaylists } from './social-cache.js';
import { mapWithConcurrency, SC_READ_CONCURRENCY } from './pacing.js';
import { safeError } from './safe-error.js';
import logger from './logger.js';

/**
 * @param {object} req                 authenticated request (user + tokens)
 * @param {object} opts
 * @param {number} opts.limit          page size
 * @param {number} opts.offset         0-based index into the full playlist list
 * @returns {Promise<{ playlists: object[], failed: {id: any, title: string|null}[], page: object }>}
 */
export async function pagePlaylistsWithTracks(req, { limit, offset }) {
  const all = await loadCachedPlaylists(req);
  const collection = Array.isArray(all?.collection) ? all.collection : [];
  const stubs = collection.slice(offset, offset + limit);

  // Per-playlist reads are independent, so fan them out rather than paying one
  // round trip per playlist end to end: ~20 at the default limit, ~50 at the
  // maximum, all inside one held-open request.
  const failed = [];
  const settled = await mapWithConcurrency(stubs, SC_READ_CONCURRENCY, async (stub) => {
    try {
      return await soundcloudClient.getPlaylistWithTracks(req.accessToken, req.refreshToken, stub.id);
    } catch (error) {
      // One unreadable playlist must not sink the page — but it is collected
      // rather than dropped, so the caller can say the results are incomplete
      // instead of quietly reporting a clean audit / zero matches.
      logger.warn('Playlist page fetch failed:', { playlistId: stub.id, error: safeError(error) });
      failed.push({ id: stub.id, title: stub.title ?? null });
      return null;
    }
  });
  const playlists = settled.filter(Boolean);

  return {
    playlists,
    failed,
    page: {
      limit,
      offset,
      returned: playlists.length,
      total: collection.length,
      hasMore: offset + limit < collection.length,
      // 1-based inclusive range, for "playlists 21-40" in the UI.
      from: stubs.length ? offset + 1 : 0,
      to: offset + stubs.length,
      // Carried through from the cache tier so the UI can say the list may be
      // a little old, or that the crawl did not reach the end of the library.
      stale: all.stale === true,
      truncated: all.truncated === true,
    },
  };
}
