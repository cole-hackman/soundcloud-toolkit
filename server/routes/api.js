import express from 'express';
import { soundcloudClient } from '../lib/soundcloud-client.js';
import prisma from '../lib/prisma.js';
import { heavyOperationRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateUser } from '../middleware/auth.js';
import { logOperation, startOperationTimer, extractClientInfo } from '../lib/analytics.js';
import { harvestTracks, harvestPlaylists } from '../lib/catalog.js';
import { piggybackEnrichment } from '../lib/enrichment.js';
import logger from '../lib/logger.js';
import { sleep, SC_WRITE_PACING_MS } from '../lib/pacing.js';
import { extractNumericId, normalizeResource, normalizeResourceV2, normalizeTrackForLibraryBrowser, normalizePlaylistForLibraryBrowser } from '../lib/normalize.js';
import { getCachedResolve, setCachedResolve } from '../lib/resolve-cache.js';
import { safeError } from '../lib/safe-error.js';
import { isAllowedDownloadRedirectTarget, isAllowedDownloadUrl } from '../lib/download-utils.js';
import { buildDashboardSummary } from '../lib/dashboard-summary.js';
import { summarizeLibraryAudit } from '../lib/library-audit.js';
import { comparePlaylists } from '../lib/playlist-compare.js';
import {
  duplicateTrackBetweenPlaylists,
  moveTrackBetweenPlaylists,
} from '../lib/playlist-transfer.js';
import { requestCache } from '../lib/request-cache.js';
import { mergeIntoExisting, splitIntoChunks } from '../lib/merge-utils.js';
import {
  validatePlaylistId,
  validateResolve,
  validateMergePlaylists,
  validateUpdatePlaylist,
  validatePlaylistTrackTransfer,
  validateCreateFromLikes,
  validateLikesPagination,
  validateBatchResolve,
  validateActivities,
  validateBulkUnlike,
  validateBulkLike,
  validateBulkUnfollow,
  validateBulkUnrepost,
  validateClonePlaylist,
  validateCloneFollowedPlaylists,
  validateCreateFromFollowedLikes,
  validateFollowedUserLibraryPagination,
  validateFollowingUserId,
  validateTrackSearch,
  validateDeletePlaylist,
  validateEvent,
  validateGrowthDiscover,
  validateGrowthCheckFollowbacks,
  validateGrowthEngageBatch,
  validateReverseGrowthActions,
} from '../middleware/validation.js';
import {
  GrowthEngine,
  getGrowthBudget,
  getEngagementJob,
  cancelEngagementJob,
  startEngagementJob,
  serializeJob,
  GROWTH_BATCH_MAX,
} from '../lib/growth-engine.js';

const growthEngine = new GrowthEngine(soundcloudClient);

const router = express.Router();

const CACHE_TTL = {
  playlists: 5 * 60 * 1000,
  followings: 5 * 60 * 1000,
  followers: 5 * 60 * 1000,
  likes: 60 * 1000,
  reposts: 60 * 1000,
  activities: 60 * 1000,
};

function getCachedUserPayload(namespace, userId, key, load, ttlMs) {
  const cached = requestCache.get(namespace, userId, key);
  if (cached !== undefined) return Promise.resolve(cached);
  return Promise.resolve(load()).then((data) => {
    requestCache.set(namespace, userId, key, data, ttlMs);
    return data;
  });
}

function invalidateUserNamespaces(userId, namespaces) {
  namespaces.forEach((namespace) => {
    requestCache.invalidateNamespaceForUser(namespace, userId);
  });
}

/* Shared cached loaders for the auth user's social lists. The GET routes and
 * growth discovery use the same namespace/key/payload shape, so whichever
 * runs first warms the cache for the other. */
function loadCachedFollowings(req) {
  return getCachedUserPayload('followings', req.user.id, 'default', async () => {
    const followings = await soundcloudClient.getFollowings(req.accessToken, req.refreshToken);
    return { collection: followings, total: followings.length };
  }, CACHE_TTL.followings);
}

function loadCachedFollowers(req) {
  return getCachedUserPayload('followers', req.user.id, 'default', async () => {
    const followers = await soundcloudClient.getFollowers(req.accessToken, req.refreshToken);
    return { collection: followers, total: followers.length };
  }, CACHE_TTL.followers);
}

function invalidatePlaylistState(userId) {
  invalidateUserNamespaces(userId, ['playlists']);
}

const SC_TOOLKIT_PLAYLIST_SITE = 'www.soundcloudtoolkit.com';
const SC_TOOLKIT_PLAYLIST_FOOTER = `Created using SC Toolkit. Try it for free ${SC_TOOLKIT_PLAYLIST_SITE}`;

/** Operation summary only; standard toolkit footer is appended for SoundCloud playlist descriptions. */
function playlistDescriptionWithToolkit(operationDescription) {
  const body = String(operationDescription ?? '').trim();
  return `${body}\n\n${SC_TOOLKIT_PLAYLIST_FOOTER}`;
}

function sanitizeUrl(input = '') {
  let url = String(input).trim();
  if (!url) return '';
  // Add scheme if missing
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    // Only allow soundcloud domains
    const host = u.hostname.toLowerCase();
    if (!/(^|\.)soundcloud\.com$/.test(host) && host !== 'on.soundcloud.com') return '';
    // Strip tracking params
    const toRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'si'];
    toRemove.forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return '';
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isResolveV2(req) {
  const queryVersion = String(req.query?.v || '').trim();
  const headerVersion = String(req.get('x-resolve-version') || '').trim();
  return queryVersion === '2' || headerVersion === '2';
}

function getPlayableTrackIds(tracks = []) {
  const seen = new Set();
  const ids = [];
  for (const track of tracks) {
    const id = extractNumericId(track?.id || track?.urn);
    if (!id || track?.blocked_at || track?.streamable === false || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function assertFollowedUser(req, targetUserId) {
  const followings = await soundcloudClient.getFollowings(req.accessToken, req.refreshToken);
  const followed = followings.find((user) => Number(user?.id) === Number(targetUserId));
  if (!followed) {
    const error = new Error('Followed user not found');
    error.status = 403;
    throw error;
  }
  return followed;
}


/**
 * GET /api/me
 * Get current user information
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const userInfo = await soundcloudClient.getMe(req.accessToken, req.refreshToken);
    logger.info('[/api/me] SC response keys:', Object.keys(userInfo));
    logger.info('[/api/me] Stats fields:', {
      followers_count: userInfo.followers_count,
      followings_count: userInfo.followings_count,
      public_favorites_count: userInfo.public_favorites_count,
      likes_count: userInfo.likes_count,
      playlist_count: userInfo.playlist_count,
      track_count: userInfo.track_count,
    });
    res.json(userInfo);
  } catch (error) {
    logger.error('Get me error:', safeError(error));
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

router.get('/dashboard/summary', authenticateUser, async (req, res) => {
  try {
    const me = await soundcloudClient.getMe(req.accessToken, req.refreshToken);
    const userId = req.user.id;
    const likesCount = me?.public_favorites_count ?? me?.likes_count;

    const needsFollowers = !(typeof me?.followers_count === 'number' && me.followers_count > 0);
    const needsFollowings = !(typeof me?.followings_count === 'number' && me.followings_count > 0);
    const needsLikes = !(typeof likesCount === 'number' && likesCount > 0);
    const needsPlaylists = !(typeof me?.playlist_count === 'number' && me.playlist_count > 0);

    const [followers, followings, likes, playlists] = await Promise.all([
      needsFollowers
        ? getCachedUserPayload(
            'followers',
            userId,
            'default',
            async () => {
              const collection = await soundcloudClient.getFollowers(req.accessToken, req.refreshToken);
              return { collection, total: collection.length };
            },
            CACHE_TTL.followers,
          )
        : Promise.resolve(undefined),
      needsFollowings
        ? getCachedUserPayload(
            'followings',
            userId,
            'default',
            async () => {
              const collection = await soundcloudClient.getFollowings(req.accessToken, req.refreshToken);
              return { collection, total: collection.length };
            },
            CACHE_TTL.followings,
          )
        : Promise.resolve(undefined),
      needsLikes
        ? getCachedUserPayload(
            'likes',
            userId,
            'default',
            async () => {
              const collection = await soundcloudClient.paginate(
                '/me/likes/tracks',
                req.accessToken,
                req.refreshToken,
                200,
              ).catch(() => soundcloudClient.paginate(
                '/me/favorites',
                req.accessToken,
                req.refreshToken,
                200,
              ));
              return { collection, total_results: collection.length };
            },
            CACHE_TTL.likes,
          )
        : Promise.resolve(undefined),
      needsPlaylists
        ? getCachedUserPayload(
            'playlists',
            userId,
            'limit=50&offset=0',
            async () => soundcloudClient.getPlaylists(
              req.accessToken,
              req.refreshToken,
              50,
              0,
            ),
            CACHE_TTL.playlists,
          )
        : Promise.resolve(undefined),
    ]);

    res.json(buildDashboardSummary({ me, followers, followings, likes, playlists }));
  } catch (error) {
    logger.error('Dashboard summary error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

router.get('/library/audit', authenticateUser, heavyOperationRateLimiter, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const playlistPage = await soundcloudClient.getPlaylists(req.accessToken, req.refreshToken, limit, 0);
    const playlists = Array.isArray(playlistPage?.collection)
      ? playlistPage.collection
      : Array.isArray(playlistPage)
        ? playlistPage
        : [];
    const fullPlaylists = [];

    for (const playlist of playlists) {
      try {
        const full = await soundcloudClient.getPlaylistWithTracks(req.accessToken, req.refreshToken, playlist.id);
        fullPlaylists.push(full);
      } catch (error) {
        logger.warn('Library audit playlist fetch failed:', { playlistId: playlist.id, error: safeError(error) });
      }
    }

    harvestTracks(fullPlaylists.flatMap(p => (Array.isArray(p.tracks) ? p.tracks : [])));
    harvestPlaylists(fullPlaylists);
    const audit = summarizeLibraryAudit(fullPlaylists);
    logOperation({
      req,
      action: 'library-audit',
      itemCount: audit.summary.playlists,
      trackCount: audit.summary.tracks,
      status: 'success',
      playlistIds: audit.playlists.map(p => p.id).filter(id => id != null),
      // Flagged tracks only — the full library would blow the row cap
      trackIds: audit.playlists.flatMap(p => p.issues.map(i => i.trackId)).filter(id => id != null),
      metadata: {
        duplicates: audit.summary.duplicates,
        unavailable: audit.summary.unavailable,
      },
    });
    res.json(audit);
  } catch (error) {
    logger.error('Library audit error:', safeError(error));
    res.status(500).json({ error: 'Failed to audit library' });
  }
});

router.post('/playlists/compare', authenticateUser, heavyOperationRateLimiter, async (req, res) => {
  try {
    const playlistAId = Number(req.body?.playlistAId);
    const playlistBId = Number(req.body?.playlistBId);
    if (!Number.isInteger(playlistAId) || playlistAId < 1 || !Number.isInteger(playlistBId) || playlistBId < 1) {
      return res.status(400).json({ error: 'playlistAId and playlistBId are required positive integers' });
    }
    if (playlistAId === playlistBId) {
      return res.status(400).json({ error: 'Choose two different playlists to compare' });
    }

    const [playlistA, playlistB] = await Promise.all([
      soundcloudClient.getPlaylistWithTracks(req.accessToken, req.refreshToken, playlistAId),
      soundcloudClient.getPlaylistWithTracks(req.accessToken, req.refreshToken, playlistBId),
    ]);

    harvestTracks([
      ...(Array.isArray(playlistA.tracks) ? playlistA.tracks : []),
      ...(Array.isArray(playlistB.tracks) ? playlistB.tracks : []),
    ]);
    harvestPlaylists([playlistA, playlistB]);
    const comparison = comparePlaylists(playlistA, playlistB);
    logOperation({
      req,
      action: 'playlist-compare',
      playlistIds: [playlistAId, playlistBId],
      itemCount: 2,
      trackCount: comparison.summary.playlistA.trackCount + comparison.summary.playlistB.trackCount,
      status: 'success',
      metadata: {
        commonTrackCount: comparison.summary.overlapCount,
        uniqueA: comparison.summary.uniqueToACount,
        uniqueB: comparison.summary.uniqueToBCount,
      },
    });
    res.json(comparison);
  } catch (error) {
    logger.error('Playlist compare error:', safeError(error));
    res.status(500).json({ error: 'Failed to compare playlists' });
  }
});

/**
 * GET /api/playlists
 * Get all of the user's playlists (fully paginated — see getAllPlaylists)
 */
router.get('/playlists', authenticateUser, async (req, res) => {
  try {
    const withCovers = await getCachedUserPayload(
      'playlists',
      req.user.id,
      'default',
      async () => {
        const playlists = await soundcloudClient.getAllPlaylists(req.accessToken, req.refreshToken);
        const collection = await Promise.all(playlists.map(async (p) => {
          const idNum = typeof p.id === 'string' ? parseInt(p.id, 10) : p.id;
          let coverUrl = p.artwork_url || '';
          if (!coverUrl) {
            try {
              const full = await soundcloudClient.getPlaylistWithTracks(req.accessToken, req.refreshToken, idNum);
              const first = Array.isArray(full.tracks) && full.tracks.length ? full.tracks[0] : null;
              coverUrl = first?.artwork_url || first?.user?.avatar_url || '';
            } catch {}
          }
          if (!coverUrl) coverUrl = p.user?.avatar_url || '';
          return { ...p, id: idNum, coverUrl };
        }));
        return { collection, total: collection.length };
      },
      CACHE_TTL.playlists,
    );
    res.json(withCovers);
  } catch (error) {
    logger.error('Get playlists error:', safeError(error));
    res.status(500).json({ error: 'Failed to get playlists' });
  }
});

/**
 * POST /api/playlists/clone
 * Clones another user's playlist to the current user's account
 */
router.post('/playlists/clone', authenticateUser, heavyOperationRateLimiter, validateClonePlaylist, async (req, res) => {
  try {
    const { url, title } = req.body;
    const cleaned = sanitizeUrl(url);

    // 1. Resolve URL
    let resource;
    try {
      resource = await soundcloudClient.resolveAny(req.accessToken, req.refreshToken, cleaned);
    } catch (e) {
      if (String(e?.message).includes('401')) {
        resource = await soundcloudClient.resolvePublic(cleaned);
      } else {
        throw e;
      }
    }

    if (resource.kind !== 'playlist') {
      return res.status(400).json({ error: 'URL must point to a playlist.' });
    }

    const sourceId = extractNumericId(resource.id || resource.urn);

    // 2. Fetch full playlist containing all tracks
    const playlist = await soundcloudClient.getPlaylistWithTracks(
      req.accessToken,
      req.refreshToken,
      sourceId
    );

    const all = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    const filtered = all.filter(t => t && !t.blocked_at && t.streamable !== false);
    harvestTracks(all);
    harvestPlaylists([playlist]);
    const trackIdsArray = filtered.map(t => t.id).filter(id => id != null);

    if (trackIdsArray.length === 0) {
      return res.status(400).json({ error: 'Playlist has no streamable tracks to clone.' });
    }

    // Helper to slow down between API calls
    const baseTitle = title || `Clone of ${playlist.title}`;

    if (trackIdsArray.length > 500) {
      const numPlaylists = Math.ceil(trackIdsArray.length / 500);
      const createdPlaylists = [];

      for (let i = 0; i < numPlaylists; i++) {
        const startIdx = i * 500;
        const endIdx = Math.min(startIdx + 500, trackIdsArray.length);
        const batch = trackIdsArray.slice(startIdx, endIdx);
        
        const playlistTitle = numPlaylists > 1 
          ? `${baseTitle} (${i + 1}/${numPlaylists})`
          : baseTitle;

        const mergeBatchSize = 100;
        const initialBatch = batch.slice(0, mergeBatchSize);
        const newPlaylist = await soundcloudClient.createPlaylist(
          req.accessToken,
          req.refreshToken,
          playlistTitle,
          playlistDescriptionWithToolkit(`Cloned from ${cleaned}`),
          initialBatch
        );

        await sleep(500);

        let addIndex = mergeBatchSize;
        while (addIndex < batch.length) {
          await sleep(SC_WRITE_PACING_MS);
          const addBatch = batch.slice(0, addIndex + mergeBatchSize);
          await soundcloudClient.addTracksToPlaylist(
            req.accessToken,
            req.refreshToken,
            newPlaylist.id,
            addBatch
          );
          addIndex += mergeBatchSize;
        }

        createdPlaylists.push({
          playlist: newPlaylist,
          partNumber: i + 1
        });

        if (i < numPlaylists - 1) {
          await sleep(500);
        }
      }

      logOperation({
        req,
        action: 'clone',
        playlistIds: [sourceId, ...createdPlaylists.map((p) => p.playlist.id)],
        trackIds: trackIdsArray,
        trackCount: trackIdsArray.length,
        status: 'split',
        metadata: { sourcePlaylistId: sourceId, numPlaylistsCreated: numPlaylists },
      });
      invalidatePlaylistState(req.user.id);
      res.json({
        playlists: createdPlaylists.map(p => p.playlist),
        stats: {
          totalTracks: trackIdsArray.length,
          numPlaylistsCreated: numPlaylists,
        }
      });
    } else {
      const mergeBatchSize = 100;
      const initialBatch = trackIdsArray.slice(0, mergeBatchSize);
      const newPlaylist = await soundcloudClient.createPlaylist(
        req.accessToken,
        req.refreshToken,
        baseTitle,
        playlistDescriptionWithToolkit(`Cloned from ${cleaned}`),
        initialBatch
      );

      await sleep(500);

      let addIndex = mergeBatchSize;
      while (addIndex < trackIdsArray.length) {
        await sleep(SC_WRITE_PACING_MS);
        const addBatch = trackIdsArray.slice(0, addIndex + mergeBatchSize);
        await soundcloudClient.addTracksToPlaylist(
          req.accessToken,
          req.refreshToken,
          newPlaylist.id,
          addBatch
        );
        addIndex += mergeBatchSize;
      }

      logOperation({
        req,
        action: 'clone',
        playlistIds: [sourceId, newPlaylist.id],
        trackIds: trackIdsArray,
        trackCount: trackIdsArray.length,
        status: 'success',
        metadata: { sourcePlaylistId: sourceId, createdPlaylistId: newPlaylist.id },
      });
      invalidatePlaylistState(req.user.id);
      res.json({
        playlist: newPlaylist,
        stats: {
          totalTracks: trackIdsArray.length,
        }
      });
    }
  } catch (error) {
    logger.error('Clone playlist error:', safeError(error));
    if (String(error?.message).includes('404')) {
      return res.status(404).json({ error: 'Source playlist not found or private.' });
    }
    res.status(500).json({ error: 'Failed to clone playlist' });
  }
});

/**
 * POST /api/playlists/transfer-track
 * Move or duplicate a single track to another playlist (user's own playlists only).
 * Body: { action: 'move' | 'duplicate', trackId, sourcePlaylistId, targetPlaylistId }
 */
router.post(
  '/playlists/transfer-track',
  authenticateUser,
  heavyOperationRateLimiter,
  validatePlaylistTrackTransfer,
  async (req, res) => {
    const { action, trackId, sourcePlaylistId, targetPlaylistId } = req.body;
    const client = soundcloudClient;

    try {
      if (action === 'duplicate') {
        const result = await duplicateTrackBetweenPlaylists({
          accessToken: req.accessToken,
          refreshToken: req.refreshToken,
          client,
          trackId,
          targetPlaylistId,
        });

        if (result.ok) {
          logOperation({
            userId: req.user.id,
            action: 'playlist-transfer',
            trackCount: result.noop ? 0 : 1,
            status: 'success',
            trackIds: [trackId],
            playlistIds: [targetPlaylistId],
            metadata: { kind: 'duplicate', noop: !!result.noop },
          });
          invalidatePlaylistState(req.user.id);
          return res.json(result);
        }

        return res.status(400).json(result);
      }

      if (action === 'move') {
        const result = await moveTrackBetweenPlaylists({
          accessToken: req.accessToken,
          refreshToken: req.refreshToken,
          client,
          trackId,
          sourcePlaylistId,
          targetPlaylistId,
        });

        if (result.ok) {
          logOperation({
            userId: req.user.id,
            action: 'playlist-transfer',
            trackCount: 1,
            status: 'success',
            trackIds: [trackId],
            playlistIds: [sourcePlaylistId, targetPlaylistId],
            metadata: { kind: 'move' },
          });
          invalidatePlaylistState(req.user.id);
          return res.json(result);
        }

        if (result.partial) {
          logOperation({
            userId: req.user.id,
            action: 'playlist-transfer',
            trackCount: 1,
            status: 'error',
            trackIds: [trackId],
            playlistIds: [sourcePlaylistId, targetPlaylistId],
            metadata: { kind: 'move', partial: true, stage: result.stage },
          });
          return res.json(result);
        }

        const status = result.error && result.error.includes('not in the source') ? 404 : 400;
        return res.status(status).json(result);
      }

      return res.status(400).json({ ok: false, error: 'Invalid action' });
    } catch (error) {
      logger.error('Playlist transfer error:', safeError(error));
      res.status(500).json({ ok: false, error: 'Playlist transfer failed' });
    }
  }
);

/**
 * GET /api/playlists/:id
 * Return single playlist with tracks included
 */
router.get('/playlists/:id', authenticateUser, validatePlaylistId, async (req, res) => {
  try {
    const id = req.params.id; // Already validated and converted to int by middleware
    const playlist = await soundcloudClient.getPlaylistWithTracks(
      req.accessToken,
      req.refreshToken,
      id
    );
    harvestTracks(Array.isArray(playlist.tracks) ? playlist.tracks : []);
    harvestPlaylists([playlist]);
    res.json(playlist);
  } catch (error) {
    logger.error('Get playlist with tracks error:', safeError(error));
    res.status(500).json({ error: 'Failed to get playlist' });
  }
});

/**
 * PUT /api/playlists/:id
 * Update playlist order/title by sending full track list
 * Body: { tracks: number[]; title?: string }
 */
router.put('/playlists/:id', authenticateUser, validateUpdatePlaylist, async (req, res) => {
  try {
    const id = req.params.id; // Already validated and converted to int by middleware
    const { tracks, title } = req.body || {};

    // Reuse addTracksToPlaylist to overwrite order by sending full list
    const updated = await soundcloudClient.addTracksToPlaylist(
      req.accessToken,
      req.refreshToken,
      id,
      tracks
    );

    // Optionally update title if provided and different
    if (title && title !== updated.title) {
      try {
        await soundcloudClient.addTracksToPlaylist(
          req.accessToken,
          req.refreshToken,
          id,
          tracks
        );
      } catch {}
    }

    invalidatePlaylistState(req.user.id);
    res.json(updated);
  } catch (error) {
    logger.error('Update playlist error:', safeError(error));
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

/**
 * GET /api/likes
 * Get user's liked tracks
 */
router.get('/likes', authenticateUser, async (req, res) => {
  try {
    const payload = await getCachedUserPayload(
      'likes',
      req.user.id,
      'default',
      async () => {
        const items = await soundcloudClient.paginate(
          '/me/likes/tracks',
          req.accessToken,
          req.refreshToken,
          200
        ).catch(() => soundcloudClient.paginate(
          '/me/favorites',
          req.accessToken,
          req.refreshToken,
          200
        ));
        harvestTracks(items);
        return { collection: items, total_results: items.length };
      },
      CACHE_TTL.likes,
    );
    res.json(payload);
  } catch (error) {
    logger.error('Get likes error:', safeError(error));
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

/**
 * GET /api/likes/paged
 * Returns one page of likes with cursor-based pagination
 * Query: limit (default 50), next (optional next_href from previous page)
 */
router.get('/likes/paged', authenticateUser, validateLikesPagination, async (req, res) => {
  try {
    const { limit = 50, next } = req.query;
    let endpoint;
    if (next) {
      try {
        const u = new URL(String(next));
        endpoint = `${u.pathname}${u.search}`;
      } catch {
        return res.status(400).json({ error: 'Invalid next cursor' });
      }
    } else {
      const params = new URLSearchParams({
        limit: String(parseInt(limit)),
        linked_partitioning: '1'
      });
      endpoint = `/me/likes/tracks?${params.toString()}`;
    }

    const page = await soundcloudClient.scRequest(endpoint, req.accessToken, req.refreshToken);
    harvestTracks(Array.isArray(page.collection) ? page.collection : []);
    res.json({
      collection: Array.isArray(page.collection) ? page.collection : [],
      next_href: page.next_href || null,
      total: page.total_results || undefined
    });
  } catch (error) {
    logger.error('Get likes paged error:', safeError(error));
    res.status(500).json({ error: 'Failed to get likes page' });
  }
});

/**
 * POST /api/resolve
 * Resolve a SoundCloud URL
 */
async function handleResolve(req, res) {
  try {
    const useV2 = isResolveV2(req);
    const rawUrl = req.method === 'GET' ? req.query?.url : req.body?.url;
    // Validation middleware already checked the URL format
    const cleaned = sanitizeUrl(rawUrl);
    if (!cleaned) return res.status(400).json({ error: 'Invalid SoundCloud URL' });

    const cached = getCachedResolve(cleaned);
    if (cached) {
      logOperation({
        userId: req.user.id,
        action: 'resolve',
        status: 'success',
        trackIds: cached?.type === 'track' && cached.id != null ? [cached.id] : undefined,
        playlistIds: cached?.type === 'playlist' && cached.id != null ? [cached.id] : undefined,
        metadata: { resolvedType: cached?.type ?? 'unknown', cached: true },
      });
      if (!useV2) return res.json(cached);
      return res.json({
        data: normalizeResourceV2(cached) || cached,
        meta: {
          version: '2',
          source_url: cleaned,
          resolved_at: nowIso(),
          cached: true,
          resolver_path: 'cache'
        }
      });
    }

    let resource;
    let resolverPath = 'oauth';
    try {
      resource = await soundcloudClient.resolveAny(req.accessToken, req.refreshToken, cleaned);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      // If token is invalid/expired, try public resolve for public resources
      if (msg.includes('invalid_grant') || msg.includes('401')) {
        try {
          resource = await soundcloudClient.resolvePublic(cleaned);
          resolverPath = 'public_fallback';
        } catch (e2) {
          // bubble up original auth error context
          throw e;
        }
      } else {
        throw e;
      }
    }
    const normalized = normalizeResource(resource);
    if (!normalized) return res.status(422).json({ error: 'Unsupported or unknown resource' });
    if (normalized.type === 'track') harvestTracks([resource]);
    else if (normalized.type === 'playlist') {
      harvestPlaylists([resource]);
      harvestTracks(Array.isArray(resource.tracks) ? resource.tracks : []);
    }

    // Optional oEmbed supplement (best effort)
    try {
      const oembedRes = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(cleaned)}`);
      if (oembedRes.ok) {
        const oem = await oembedRes.json();
        if (normalized.type === 'track' || normalized.type === 'playlist') {
          normalized.artwork_url = normalized.artwork_url || oem.thumbnail_url;
        } else if (normalized.type === 'user') {
          normalized.avatar_url = normalized.avatar_url || oem.thumbnail_url;
        }
      }
    } catch {}

    setCachedResolve(cleaned, normalized);
    if (!useV2) {
      res.json(normalized);
    } else {
      res.json({
        data: normalizeResourceV2(resource),
        meta: {
          version: '2',
          source_url: cleaned,
          resolved_at: nowIso(),
          cached: false,
          resolver_path: resolverPath
        }
      });
    }
    logOperation({
      userId: req.user.id,
      action: 'resolve',
      status: 'success',
      trackIds: normalized.type === 'track' && normalized.id != null ? [normalized.id] : undefined,
      playlistIds: normalized.type === 'playlist' && normalized.id != null ? [normalized.id] : undefined,
      metadata: { resolvedType: normalized.type ?? 'unknown', cached: false },
    });
  } catch (error) {
    logger.error('Resolve error:', safeError(error));
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('invalid_grant')) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    if (msg.includes('401')) return res.status(401).json({ error: 'Unauthorized to resolve this URL. Sign in and try again.' });
    if (msg.includes('404')) return res.status(404).json({ error: 'Resource not found or private.' });
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
}

router.post('/resolve', authenticateUser, heavyOperationRateLimiter, validateResolve, handleResolve);
router.get('/resolve', authenticateUser, heavyOperationRateLimiter, validateResolve, handleResolve);

/**
 * GET /api/proxy-download
 * Proxy a download request to SoundCloud to verify auth and get the final link
 */
router.get('/proxy-download', authenticateUser, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    if (!isAllowedDownloadUrl(url)) {
      return res.status(400).json({ error: 'Invalid download URL' });
    }

    // The URL already passed isAllowedDownloadUrl, so the track ID is extractable
    const downloadTrackId = Number(url.match(/\/tracks\/(\d+)\/download/)?.[1]) || null;
    const result = await soundcloudClient.getDownloadLink(req.accessToken, req.refreshToken, url);

    if (result && result.redirect) {
      const loc = result.redirect;
      if (isAllowedDownloadRedirectTarget(loc)) {
        logOperation({
          userId: req.user.id,
          action: 'proxy-download',
          status: 'success',
          trackIds: downloadTrackId ? [downloadTrackId] : undefined,
        });
        if (req.query.format === 'json') {
          return res.json({ url: loc });
        }
        return res.redirect(loc);
      }
      logOperation({
        userId: req.user.id,
        action: 'proxy-download',
        status: 'error',
        trackIds: downloadTrackId ? [downloadTrackId] : undefined,
        metadata: { reason: 'invalid_redirect_target' },
      });
      return res.status(502).json({ error: 'Invalid download redirect target' });
    }
    
    res.status(404).json({ error: 'Could not resolve download link' });
  } catch (error) {
    logger.error('Proxy download error:', safeError(error));
    res.status(500).json({ error: 'Failed to proxy download' });
  }
});

/**
 * POST /api/playlists/merge
 * Merge multiple playlists (into new or existing playlist)
 */
router.post('/playlists/merge', authenticateUser, heavyOperationRateLimiter, validateMergePlaylists, async (req, res) => {
  const elapsed = startOperationTimer();
  try {
    const { sourcePlaylistIds, title, targetPlaylistId, deleteAfterMerge } = req.body;
    // Validation middleware already checked the input

    // Helper to slow down between API calls

    // Get all tracks from source playlists (with tracks included)
    const perPlaylistCounts = [];
    let fetchedTotal = 0;
    let acceptedTotal = 0;
    const trackIdSet = new Set();
    for (const playlistId of sourcePlaylistIds) {
      const playlist = await soundcloudClient.getPlaylistWithTracks(
        req.accessToken,
        req.refreshToken,
        playlistId
      );
      const all = Array.isArray(playlist.tracks) ? playlist.tracks : [];
      const filtered = all.filter(t => t && !t.blocked_at && t.streamable !== false);
      harvestTracks(all); // blocked/preview tracks are catalog signal too
      harvestPlaylists([playlist]);
      fetchedTotal += all.length;
      acceptedTotal += filtered.length;
      perPlaylistCounts.push({ id: playlistId, fetched: all.length, accepted: filtered.length });
      for (const t of filtered) {
        if (t.id != null) trackIdSet.add(t.id);
      }
      await sleep(SC_WRITE_PACING_MS); // small pause between playlist fetches
    }

    // ── MERGE INTO EXISTING PLAYLIST ──────────────────────────────────────────
    if (targetPlaylistId) {
      // Fetch existing target playlist tracks
      const targetPlaylist = await soundcloudClient.getPlaylistWithTracks(
        req.accessToken,
        req.refreshToken,
        targetPlaylistId
      );
      const existingIds = (Array.isArray(targetPlaylist.tracks) ? targetPlaylist.tracks : [])
        .filter(t => t && t.id != null)
        .map(t => t.id);
      const existingTrackCount = existingIds.length;

      // Merge: preserve existing order, append new unique source tracks
      const { mergedIds, addedCount } = mergeIntoExisting(existingIds, Array.from(trackIdSet));

      // Split into 500-track chunks (target gets first chunk, overflow gets new playlists)
      const chunks = splitIntoChunks(mergedIds, 500);
      const targetChunk = chunks[0] || [];
      const overflowChunks = chunks.slice(1);

      // Update target playlist in 100-track batches
      const mergeBatchSize = 100;
      let updateIndex = mergeBatchSize;
      while (updateIndex < targetChunk.length) {
        await sleep(SC_WRITE_PACING_MS);
        const batch = targetChunk.slice(0, updateIndex + mergeBatchSize);
        await soundcloudClient.addTracksToPlaylist(
          req.accessToken,
          req.refreshToken,
          targetPlaylistId,
          batch
        );
        updateIndex += mergeBatchSize;
      }

      // If target chunk has <= 100 tracks (or remaining after batches), update directly if needed
      if (targetChunk.length <= 100) {
        await soundcloudClient.addTracksToPlaylist(
          req.accessToken,
          req.refreshToken,
          targetPlaylistId,
          targetChunk
        );
      }

      // Create new playlists for overflow chunks (>500 tracks)
      const baseTitle = (title && title.trim()) || targetPlaylist.title || 'Merged Playlist';
      const overflowPlaylists = [];
      for (let i = 0; i < overflowChunks.length; i++) {
        await sleep(SC_WRITE_PACING_MS);
        const chunk = overflowChunks[i];
        const partNumber = i + 2; // Part 1 is targetPlaylist
        const partTitle = `${baseTitle} (Part ${partNumber})`;
        const newPl = await soundcloudClient.createPlaylist(
          req.accessToken,
          req.refreshToken,
          partTitle,
          playlistDescriptionWithToolkit(`Merged overflow part ${partNumber}`),
          chunk.slice(0, mergeBatchSize)
        );

        let addIndex = mergeBatchSize;
        while (addIndex < chunk.length) {
          await sleep(SC_WRITE_PACING_MS);
          const batch = chunk.slice(0, addIndex + mergeBatchSize);
          await soundcloudClient.addTracksToPlaylist(
            req.accessToken,
            req.refreshToken,
            newPl.id,
            batch
          );
          addIndex += mergeBatchSize;
        }

        overflowPlaylists.push({
          id: newPl.id,
          title: partTitle,
          trackCount: chunk.length,
          partNumber,
        });
      }

      // Optionally delete source playlists (never delete the target)
      let deletedPlaylistIds = [];
      let deleteErrors = [];
      if (deleteAfterMerge) {
        const toDelete = sourcePlaylistIds.filter(id => id !== targetPlaylistId);
        for (const id of toDelete) {
          await sleep(SC_WRITE_PACING_MS);
          try {
            await soundcloudClient.deletePlaylist(req.accessToken, req.refreshToken, id);
            deletedPlaylistIds.push(id);
          } catch (err) {
            deleteErrors.push({ id, error: safeError(err).message || 'Delete failed' });
          }
        }
      }

      const finalCount = mergedIds.length;
      logger.info('[merge] merged into existing playlist', {
        targetPlaylistId,
        existingTrackCount,
        addedCount,
        finalCount,
        overflowPlaylists: overflowPlaylists.length,
        deletedCount: deletedPlaylistIds.length,
      });

      logOperation({
        userId: req.user.id,
        action: 'merge',
        trackCount: addedCount,
        status: 'success',
        durationMs: elapsed(),
        clientInfo: extractClientInfo(req),
        playlistIds: [...sourcePlaylistIds, targetPlaylistId, ...overflowPlaylists.map(p => p.id)],
        trackIds: Array.from(trackIdSet),
        metadata: {
          mode: 'into-existing',
          sourceCount: sourcePlaylistIds.length,
          totalTracks: finalCount,
          playlistsCreated: overflowPlaylists.length,
          finalCount,
          targetPlaylistId,
          existingTrackCount,
          addedCount,
          deletedCount: deletedPlaylistIds.length,
        },
      });
      invalidatePlaylistState(req.user.id);

      return res.json({
        playlist: { id: targetPlaylistId, title: targetPlaylist.title },
        overflowPlaylists: overflowPlaylists.length > 0 ? overflowPlaylists : undefined,
        deletedPlaylistIds: deletedPlaylistIds.length > 0 ? deletedPlaylistIds : undefined,
        deleteErrors: deleteErrors.length > 0 ? deleteErrors : undefined,
        stats: {
          sourcePlaylists: sourcePlaylistIds.length,
          perPlaylistCounts,
          fetchedTotal,
          acceptedTotal,
          existingTrackCount,
          addedCount,
          totalTracks: finalCount,
          overflowCount: overflowPlaylists.length,
        },
      });
    }
    // ── END MERGE INTO EXISTING ───────────────────────────────────────────────

    const trackIdsArray = Array.from(trackIdSet);
    const uniqueBeforeCap = trackIdsArray.length;
    const baseTitle = (title && title.trim()) || 'Merged Playlist';

    // If tracks exceed 500, split into multiple playlists
    if (trackIdsArray.length > 500) {
      const chunks = [];
      for (let i = 0; i < trackIdsArray.length; i += 500) {
        chunks.push(trackIdsArray.slice(i, i + 500));
      }

      const numPlaylists = chunks.length;
      const createdPlaylists = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const partTitle = `${baseTitle} (${i + 1}/${numPlaylists})`;
        const mergeBatchSize = 100;
        const initialBatch = chunk.slice(0, mergeBatchSize);

        const newPlaylist = await soundcloudClient.createPlaylist(
          req.accessToken,
          req.refreshToken,
          partTitle,
          playlistDescriptionWithToolkit(`Part ${i + 1} of ${numPlaylists} merged from ${sourcePlaylistIds.length} playlists`),
          initialBatch
        );

        await sleep(500);

        let finalCount = initialBatch.length;
        let addIndex = mergeBatchSize;
        while (addIndex < chunk.length) {
          await sleep(SC_WRITE_PACING_MS);
          const addBatch = chunk.slice(0, addIndex + mergeBatchSize);
          await soundcloudClient.addTracksToPlaylist(
            req.accessToken,
            req.refreshToken,
            newPlaylist.id,
            addBatch
          );
          finalCount += addBatch.length;
          addIndex += mergeBatchSize;
        }

        createdPlaylists.push({
          playlist: newPlaylist,
          trackCount: chunk.length,
          partNumber: i + 1
        });

        if (i < chunks.length - 1) {
          await sleep(SC_WRITE_PACING_MS);
        }
      }

      logger.info('[merge] split completed', {
        sourceCount: sourcePlaylistIds.length,
        fetchedTotal,
        acceptedTotal,
        uniqueBeforeCap,
        totalTracks: trackIdsArray.length,
        numPlaylistsCreated: numPlaylists
      });

      res.json({
        playlists: createdPlaylists.map(p => ({
          ...p.playlist,
          track_count: p.trackCount,
          part_number: p.partNumber,
          total_parts: numPlaylists
        })),
        stats: {
          sourcePlaylists: sourcePlaylistIds.length,
          perPlaylistCounts,
          fetchedTotal,
          acceptedTotal,
          uniqueBeforeCap,
          totalTracks: trackIdsArray.length,
          numPlaylistsCreated: numPlaylists,
          playlistsCreated: createdPlaylists.map(p => ({
            id: p.playlist.id,
            title: p.playlist.title,
            trackCount: p.trackCount,
            partNumber: p.partNumber
          }))
        }
      });
      logOperation({
        userId: req.user.id,
        action: 'merge',
        trackCount: trackIdsArray.length,
        status: 'split',
        durationMs: elapsed(),
        clientInfo: extractClientInfo(req),
        playlistIds: [...sourcePlaylistIds, ...createdPlaylists.map(p => p.playlist.id)],
        trackIds: trackIdsArray,
        metadata: {
          mode: 'split',
          sourceCount: sourcePlaylistIds.length,
          totalTracks: trackIdsArray.length,
          playlistsCreated: numPlaylists,
          fetchedTotal,
          acceptedTotal,
          uniqueBeforeCap,
        },
      });
      invalidatePlaylistState(req.user.id);
    } else {
      // Single playlist (<= 500 tracks) with 100-track batches
      const playlistTitle = baseTitle;
      const mergeBatchSize = 100;
      const initialBatch = trackIdsArray.slice(0, mergeBatchSize);
      const newPlaylist = await soundcloudClient.createPlaylist(
        req.accessToken,
        req.refreshToken,
        playlistTitle,
        playlistDescriptionWithToolkit(`Merged from ${sourcePlaylistIds.length} playlists`),
        initialBatch
      );

      logger.info('[merge] created playlist', { id: newPlaylist.id, initialCount: initialBatch.length });
      await sleep(500);

      let finalCount = initialBatch.length;
      let addIndex = mergeBatchSize;
      while (addIndex < trackIdsArray.length) {
        await sleep(SC_WRITE_PACING_MS);
        const addBatch = trackIdsArray.slice(0, addIndex + mergeBatchSize);
        await soundcloudClient.addTracksToPlaylist(
          req.accessToken,
          req.refreshToken,
          newPlaylist.id,
          addBatch
        );
        finalCount += addBatch.length;
        addIndex += mergeBatchSize;
      }

      // Verify current count if possible
      let verifiedCount = finalCount;
      try {
        const verified = await soundcloudClient.getPlaylistWithTracks(
          req.accessToken,
          req.refreshToken,
          newPlaylist.id
        );
        verifiedCount = Array.isArray(verified.tracks) ? verified.tracks.length : (verified.track_count || verifiedCount);
      } catch {}

      logger.info('[merge] summary', {
        sourceCount: sourcePlaylistIds.length,
        fetchedTotal,
        acceptedTotal,
        uniqueBeforeCap,
        totalTracks: trackIdsArray.length,
        createdId: newPlaylist.id,
        verifiedCount
      });

      res.json({
        playlist: newPlaylist,
        stats: {
          sourcePlaylists: sourcePlaylistIds.length,
          perPlaylistCounts,
          fetchedTotal,
          acceptedTotal,
          uniqueBeforeCap,
          totalTracks: trackIdsArray.length,
          finalCount: verifiedCount
        }
      });
      logOperation({
        userId: req.user.id,
        action: 'merge',
        trackCount: trackIdsArray.length,
        status: 'success',
        durationMs: elapsed(),
        clientInfo: extractClientInfo(req),
        playlistIds: [...sourcePlaylistIds, newPlaylist.id],
        trackIds: trackIdsArray,
        metadata: {
          mode: 'new',
          sourceCount: sourcePlaylistIds.length,
          totalTracks: trackIdsArray.length,
          playlistsCreated: 1,
          finalCount: verifiedCount,
          fetchedTotal,
          acceptedTotal,
          uniqueBeforeCap,
        },
      });
      invalidatePlaylistState(req.user.id);
    }
  } catch (error) {
    logger.error('Merge playlists error:', safeError(error));
    logOperation({
      userId: req.user.id,
      action: 'merge',
      status: 'error',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      // try-scoped arrays aren't visible here; fall back to the validated body
      playlistIds: Array.isArray(req.body?.sourcePlaylistIds) ? req.body.sourcePlaylistIds : undefined,
      errorCode: error.name || 'MERGE_FAILED',
      errorMessage: safeError(error).message,
    });
    res.status(500).json({ error: 'Failed to merge playlists' });
  }
});

const BATCH_SIZE_PLAYLIST_TRACKS = 100;
const MAX_TRACKS_PER_PLAYLIST = 500;

/**
 * Create a single playlist from track IDs using 100-track batches (SoundCloud API limit).
 * @param {string} operationDescription - Summary only; SC Toolkit footer is appended automatically.
 */
async function createPlaylistFromTrackIds(accessToken, refreshToken, trackIds, title, operationDescription) {
  const initialBatch = trackIds.slice(0, BATCH_SIZE_PLAYLIST_TRACKS);
  const newPlaylist = await soundcloudClient.createPlaylist(
    accessToken,
    refreshToken,
    title,
    playlistDescriptionWithToolkit(operationDescription),
    initialBatch
  );

  let index = BATCH_SIZE_PLAYLIST_TRACKS;
  while (index < trackIds.length) {
    await sleep(SC_WRITE_PACING_MS);
    const batch = trackIds.slice(0, index + BATCH_SIZE_PLAYLIST_TRACKS);
    await soundcloudClient.addTracksToPlaylist(
      accessToken,
      refreshToken,
      newPlaylist.id,
      batch
    );
    index += BATCH_SIZE_PLAYLIST_TRACKS;
  }

  return newPlaylist;
}

function uniquePositiveIds(ids = []) {
  const seen = new Set();
  const unique = [];
  for (const id of ids) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId < 1 || seen.has(numericId)) continue;
    seen.add(numericId);
    unique.push(numericId);
  }
  return unique;
}

/** @param {string} [description] - Operation summary only (no footer); required when creating new playlist(s). */
async function createOrAppendTrackIds({ accessToken, refreshToken, trackIds, title, targetPlaylistId, description }) {
  const uniqueTrackIds = uniquePositiveIds(trackIds);

  if (targetPlaylistId) {
    const targetPlaylist = await soundcloudClient.getPlaylistWithTracks(accessToken, refreshToken, targetPlaylistId);
    const existingIds = (Array.isArray(targetPlaylist.tracks) ? targetPlaylist.tracks : [])
      .filter((track) => track && track.id != null)
      .map((track) => track.id);
    const { mergedIds, addedCount } = mergeIntoExisting(existingIds, uniqueTrackIds);
    const chunks = splitIntoChunks(mergedIds, MAX_TRACKS_PER_PLAYLIST);
    const targetChunk = chunks[0] || [];
    const overflowChunks = chunks.slice(1);

    let index = BATCH_SIZE_PLAYLIST_TRACKS;
    while (index < targetChunk.length) {
      await sleep(SC_WRITE_PACING_MS);
      await soundcloudClient.addTracksToPlaylist(accessToken, refreshToken, targetPlaylistId, targetChunk.slice(0, index));
      index += BATCH_SIZE_PLAYLIST_TRACKS;
    }

    await sleep(SC_WRITE_PACING_MS);
    await soundcloudClient.addTracksToPlaylist(accessToken, refreshToken, targetPlaylistId, targetChunk);

    const overflowPlaylists = [];
    const baseTitle = targetPlaylist.title || title || 'Playlist';
    for (let i = 0; i < overflowChunks.length; i++) {
      await sleep(500);
      const overflowTitle = `${baseTitle} (overflow ${i + 1})`;
      const overflowPlaylist = await createPlaylistFromTrackIds(
        accessToken,
        refreshToken,
        overflowChunks[i],
        overflowTitle,
        `Overflow from adding tracks to "${baseTitle}"`
      );
      overflowPlaylists.push({
        id: overflowPlaylist.id,
        title: overflowTitle,
        permalink_url: overflowPlaylist.permalink_url,
        trackCount: overflowChunks[i].length,
      });
    }

    return {
      playlist: { id: targetPlaylistId, title: targetPlaylist.title },
      overflowPlaylists: overflowPlaylists.length > 0 ? overflowPlaylists : undefined,
      totalTracks: mergedIds.length,
      addedCount,
      existingTrackCount: existingIds.length,
    };
  }

  if (uniqueTrackIds.length <= MAX_TRACKS_PER_PLAYLIST) {
    const newPlaylist = await createPlaylistFromTrackIds(accessToken, refreshToken, uniqueTrackIds, title, description);
    return {
      playlistId: newPlaylist.id,
      permalink_url: newPlaylist.permalink_url,
      playlist: { id: newPlaylist.id, title, permalink_url: newPlaylist.permalink_url },
      totalTracks: uniqueTrackIds.length,
    };
  }

  const chunks = splitIntoChunks(uniqueTrackIds, MAX_TRACKS_PER_PLAYLIST);
  const playlists = [];
  for (let i = 0; i < chunks.length; i++) {
    const playlistTitle = `${title} (${i + 1}/${chunks.length})`;
    const partSuffix = chunks.length > 1 ? ` - Part ${i + 1} of ${chunks.length}` : '';
    const newPlaylist = await createPlaylistFromTrackIds(
      accessToken,
      refreshToken,
      chunks[i],
      playlistTitle,
      `${description}${partSuffix}`
    );
    playlists.push({
      id: newPlaylist.id,
      title: playlistTitle,
      permalink_url: newPlaylist.permalink_url,
      trackCount: chunks[i].length,
    });
    if (i < chunks.length - 1) await sleep(500);
  }

  return {
    playlists,
    totalTracks: uniqueTrackIds.length,
    numPlaylistsCreated: playlists.length,
  };
}

router.get(
  '/followings/:userId/likes/paged',
  authenticateUser,
  validateFollowingUserId,
  validateFollowedUserLibraryPagination,
  async (req, res) => {
    try {
      const targetUser = await assertFollowedUser(req, req.params.userId);
      const page = await soundcloudClient.getUserLikedTracksPage(req.accessToken, req.refreshToken, req.params.userId, {
        limit: req.query.limit || 50,
        next: req.query.next,
      });
      const collection = (Array.isArray(page.collection) ? page.collection : [])
        .map(normalizeTrackForLibraryBrowser)
        .filter(Boolean);
      res.json({
        user: {
          id: targetUser.id,
          username: targetUser.username,
          avatar_url: targetUser.avatar_url,
          permalink_url: targetUser.permalink_url,
        },
        collection,
        next_href: page.next_href || null,
        total: page.total_results || undefined,
      });
    } catch (error) {
      logger.error('Get followed user liked tracks error:', safeError(error));
      const status = error?.status || 500;
      res.status(status === 403 ? 403 : 500).json({
        error: status === 403 ? 'Choose a user you follow to browse their public likes.' : 'Failed to get followed user likes',
      });
    }
  }
);

router.get(
  '/followings/:userId/playlists/paged',
  authenticateUser,
  validateFollowingUserId,
  validateFollowedUserLibraryPagination,
  async (req, res) => {
    try {
      const targetUser = await assertFollowedUser(req, req.params.userId);
      const page = await soundcloudClient.getUserPlaylistsPage(req.accessToken, req.refreshToken, req.params.userId, {
        limit: req.query.limit || 50,
        next: req.query.next,
      });
      const collection = (Array.isArray(page.collection) ? page.collection : [])
        .map(normalizePlaylistForLibraryBrowser)
        .filter(Boolean);
      res.json({
        user: {
          id: targetUser.id,
          username: targetUser.username,
          avatar_url: targetUser.avatar_url,
          permalink_url: targetUser.permalink_url,
        },
        collection,
        next_href: page.next_href || null,
        total: page.total_results || undefined,
      });
    } catch (error) {
      logger.error('Get followed user playlists error:', safeError(error));
      const status = error?.status || 500;
      res.status(status === 403 ? 403 : 500).json({
        error: status === 403 ? 'Choose a user you follow to browse their public playlists.' : 'Failed to get followed user playlists',
      });
    }
  }
);

router.get(
  '/followings/:userId/liked-playlists/paged',
  authenticateUser,
  validateFollowingUserId,
  validateFollowedUserLibraryPagination,
  async (req, res) => {
    try {
      const targetUser = await assertFollowedUser(req, req.params.userId);
      const page = await soundcloudClient.getUserLikedPlaylistsPage(req.accessToken, req.refreshToken, req.params.userId, {
        limit: req.query.limit || 50,
        next: req.query.next,
      });
      const collection = (Array.isArray(page.collection) ? page.collection : [])
        .map(normalizePlaylistForLibraryBrowser)
        .filter(Boolean);
      res.json({
        user: {
          id: targetUser.id,
          username: targetUser.username,
          avatar_url: targetUser.avatar_url,
          permalink_url: targetUser.permalink_url,
        },
        collection,
        next_href: page.next_href || null,
        total: page.total_results || undefined,
      });
    } catch (error) {
      logger.error('Get followed user liked playlists error:', safeError(error));
      const status = error?.status || 500;
      res.status(status === 403 ? 403 : 500).json({
        error: status === 403 ? 'Choose a user you follow to browse their public liked playlists.' : 'Failed to get followed user liked playlists',
      });
    }
  }
);

router.post(
  '/followings/:userId/likes/playlist',
  authenticateUser,
  heavyOperationRateLimiter,
  validateFollowingUserId,
  validateCreateFromFollowedLikes,
  async (req, res) => {
    try {
      const targetUser = await assertFollowedUser(req, req.params.userId);
      const { mode, targetPlaylistId } = req.body;
      const baseTitle = req.body.title?.trim() || `${targetUser.username || 'Followed user'} Likes`;
      let fetchedTotal;
      let acceptedTotal;
      let trackIds;

      if (mode === 'all') {
        const tracks = await soundcloudClient.getUserLikedTracks(req.accessToken, req.refreshToken, req.params.userId, 200);
        fetchedTotal = tracks.length;
        trackIds = getPlayableTrackIds(tracks);
        acceptedTotal = trackIds.length;
      } else {
        trackIds = uniquePositiveIds(req.body.trackIds);
        fetchedTotal = trackIds.length;
        acceptedTotal = trackIds.length;
      }

      if (trackIds.length === 0) {
        return res.status(400).json({ error: 'No public streamable tracks were available to add.' });
      }

      const result = await createOrAppendTrackIds({
        accessToken: req.accessToken,
        refreshToken: req.refreshToken,
        trackIds,
        title: baseTitle,
        targetPlaylistId,
        description: `Playlist created from ${targetUser.username || 'a followed user'}'s public liked tracks`,
      });

      logOperation({
        userId: req.user.id,
        action: 'followed-likes-to-playlist',
        trackCount: trackIds.length,
        status: result.numPlaylistsCreated && result.numPlaylistsCreated > 1 ? 'split' : 'success',
        trackIds,
        playlistIds: result.playlists
          ? result.playlists.map(p => p.id)
          : [result.playlist?.id, ...(result.overflowPlaylists || []).map(p => p.id)].filter(Boolean),
        targetUserIds: [Number(req.params.userId)],
      });

      invalidatePlaylistState(req.user.id);
      res.json({
        ...result,
        stats: {
          sourceUserId: Number(req.params.userId),
          sourceUsername: targetUser.username,
          fetchedTotal,
          acceptedTotal,
          mode,
        },
      });
    } catch (error) {
      logger.error('Create playlist from followed likes error:', safeError(error));
      const status = error?.status || 500;
      res.status(status === 403 ? 403 : 500).json({
        error: status === 403 ? 'Choose a user you follow to create from their public likes.' : 'Failed to create playlist from followed user likes',
      });
    }
  }
);

router.post(
  '/followings/:userId/playlists/clone',
  authenticateUser,
  heavyOperationRateLimiter,
  validateFollowingUserId,
  validateCloneFollowedPlaylists,
  async (req, res) => {
    try {
      const targetUser = await assertFollowedUser(req, req.params.userId);
      const playlistIds = uniquePositiveIds(req.body.playlistIds);
      const titlePrefix = req.body.titlePrefix?.trim();
      const playlists = [];
      const errors = [];
      const perPlaylistCounts = [];
      let fetchedTotal = 0;
      let acceptedTotal = 0;

      for (const playlistId of playlistIds) {
        try {
          const playlist = await soundcloudClient.getPlaylistWithTracks(req.accessToken, req.refreshToken, playlistId);
          const allTracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
          const trackIds = getPlayableTrackIds(allTracks);
          fetchedTotal += allTracks.length;
          acceptedTotal += trackIds.length;
          perPlaylistCounts.push({ id: playlistId, fetched: allTracks.length, accepted: trackIds.length });

          if (trackIds.length === 0) {
            errors.push({ id: playlistId, error: 'Playlist has no public streamable tracks to clone.' });
            continue;
          }

          const sourceTitle = playlist.title || `Playlist ${playlistId}`;
          const baseTitle = titlePrefix ? `${titlePrefix} - ${sourceTitle}` : `Clone of ${sourceTitle}`;
          const chunks = splitIntoChunks(trackIds, MAX_TRACKS_PER_PLAYLIST);

          for (let i = 0; i < chunks.length; i++) {
            const playlistTitle = chunks.length > 1 ? `${baseTitle} (${i + 1}/${chunks.length})` : baseTitle;
            const created = await createPlaylistFromTrackIds(
              req.accessToken,
              req.refreshToken,
              chunks[i],
              playlistTitle,
              `Cloned from ${playlist.permalink_url || `${targetUser.username || 'followed user'} playlist ${playlistId}`}`
            );
            playlists.push({
              id: created.id,
              title: playlistTitle,
              permalink_url: created.permalink_url,
              trackCount: chunks[i].length,
              sourcePlaylistId: playlistId,
            });
          }
        } catch (error) {
          logger.warn('Followed playlist clone item failed:', { playlistId, error: safeError(error) });
          errors.push({ id: playlistId, error: 'Playlist could not be cloned. It may be private or unavailable.' });
        }
      }

      if (playlists.length === 0) {
        return res.status(400).json({
          error: 'No selected playlists had public streamable tracks to clone.',
          errors,
        });
      }

      logOperation({
        userId: req.user.id,
        action: 'followed-playlist-clone',
        itemCount: playlistIds.length,
        trackCount: acceptedTotal,
        status: errors.length > 0 ? 'partial' : 'success',
        playlistIds: [...playlistIds, ...playlists.map(p => p.id)],
        targetUserIds: [Number(req.params.userId)],
      });

      invalidatePlaylistState(req.user.id);
      res.status(errors.length > 0 ? 207 : 200).json({
        playlists,
        errors: errors.length > 0 ? errors : undefined,
        stats: {
          sourceUserId: Number(req.params.userId),
          sourceUsername: targetUser.username,
          sourcePlaylists: playlistIds.length,
          fetchedTotal,
          acceptedTotal,
          numPlaylistsCreated: playlists.length,
          perPlaylistCounts,
        },
      });
    } catch (error) {
      logger.error('Clone followed playlists error:', safeError(error));
      const status = error?.status || 500;
      res.status(status === 403 ? 403 : 500).json({
        error: status === 403 ? 'Choose a user you follow to clone their public playlists.' : 'Failed to clone followed user playlists',
      });
    }
  }
);

/**
 * POST /api/playlists/from-likes
 * Create playlist(s) from liked tracks, or append to an existing playlist.
 * Uses 100-track batches. If >500 tracks, creates multiple playlists.
 */
router.post('/playlists/from-likes', authenticateUser, heavyOperationRateLimiter, validateCreateFromLikes, async (req, res) => {
  try {
    const { title, trackIds, targetPlaylistId } = req.body;

    // ── ADD TO EXISTING PLAYLIST ──────────────────────────────────────────────
    if (targetPlaylistId) {
      // Fetch existing target playlist tracks
      const targetPlaylist = await soundcloudClient.getPlaylistWithTracks(
        req.accessToken,
        req.refreshToken,
        targetPlaylistId
      );
      const existingIds = (Array.isArray(targetPlaylist.tracks) ? targetPlaylist.tracks : [])
        .filter(t => t && t.id != null)
        .map(t => t.id);
      const existingTrackCount = existingIds.length;

      // Merge: preserve existing order, append new unique tracks
      const { mergedIds, addedCount } = mergeIntoExisting(existingIds, trackIds);

      // Split into 500-track chunks
      const chunks = splitIntoChunks(mergedIds, MAX_TRACKS_PER_PLAYLIST);
      const targetChunk = chunks[0] || [];
      const overflowChunks = chunks.slice(1);

      // Update target playlist in 100-track batches
      const batchSize = 100;
      let i = batchSize;
      while (i < targetChunk.length) {
        await sleep(SC_WRITE_PACING_MS);
        await soundcloudClient.addTracksToPlaylist(
          req.accessToken,
          req.refreshToken,
          targetPlaylistId,
          targetChunk.slice(0, i)
        );
        i += batchSize;
      }
      // Final PUT with full target chunk
      await sleep(SC_WRITE_PACING_MS);
      await soundcloudClient.addTracksToPlaylist(
        req.accessToken,
        req.refreshToken,
        targetPlaylistId,
        targetChunk
      );

      // Create overflow playlists for tracks beyond 500
      const overflowPlaylists = [];
      const baseTitle = targetPlaylist.title || 'Playlist';
      for (let j = 0; j < overflowChunks.length; j++) {
        await sleep(500);
        const overflowTitle = `${baseTitle} (overflow ${j + 1})`;
        const overflowPlaylist = await createPlaylistFromTrackIds(
          req.accessToken,
          req.refreshToken,
          overflowChunks[j],
          overflowTitle,
          `Overflow from adding likes to "${baseTitle}"`
        );
        overflowPlaylists.push({ id: overflowPlaylist.id, title: overflowTitle, permalink_url: overflowPlaylist.permalink_url, trackCount: overflowChunks[j].length });
      }

      logOperation({
        userId: req.user.id,
        action: 'from-likes',
        trackCount: addedCount,
        status: 'success',
        playlistIds: [targetPlaylistId, ...overflowPlaylists.map(p => p.id)],
        trackIds,
      });
      // Client sends bare IDs — the catalog learns their names via enrichment
      piggybackEnrichment(trackIds, req.accessToken, req.refreshToken);
      invalidatePlaylistState(req.user.id);

      return res.json({
        playlist: { id: targetPlaylistId, title: targetPlaylist.title },
        overflowPlaylists: overflowPlaylists.length > 0 ? overflowPlaylists : undefined,
        totalTracks: mergedIds.length,
        addedCount,
        existingTrackCount,
      });
    }
    // ── END ADD TO EXISTING ───────────────────────────────────────────────────

    const baseTitle = title?.trim() || `My Liked Tracks - ${new Date().toLocaleDateString()}`;

    if (trackIds.length <= MAX_TRACKS_PER_PLAYLIST) {
      const newPlaylist = await createPlaylistFromTrackIds(
        req.accessToken,
        req.refreshToken,
        trackIds,
        baseTitle,
        `Playlist created from ${trackIds.length} liked tracks`
      );
      res.json({
        playlistId: newPlaylist.id,
        permalink_url: newPlaylist.permalink_url,
        playlist: { id: newPlaylist.id, title: baseTitle, permalink_url: newPlaylist.permalink_url },
        totalTracks: trackIds.length
      });
      logOperation({
        userId: req.user.id,
        action: 'from-likes',
        trackCount: trackIds.length,
        status: 'success',
        playlistIds: [newPlaylist.id],
        trackIds,
      });
      piggybackEnrichment(trackIds, req.accessToken, req.refreshToken);
      invalidatePlaylistState(req.user.id);
      return;
    }

    const numPlaylists = Math.ceil(trackIds.length / MAX_TRACKS_PER_PLAYLIST);
    const createdPlaylists = [];

    for (let i = 0; i < numPlaylists; i++) {
      const startIdx = i * MAX_TRACKS_PER_PLAYLIST;
      const endIdx = Math.min(startIdx + MAX_TRACKS_PER_PLAYLIST, trackIds.length);
      const chunk = trackIds.slice(startIdx, endIdx);
      const playlistTitle = numPlaylists > 1
        ? `${baseTitle} (${i + 1}/${numPlaylists})`
        : baseTitle;
      const description = `Playlist created from liked tracks${numPlaylists > 1 ? ` - Part ${i + 1} of ${numPlaylists}` : ''}`;

      const newPlaylist = await createPlaylistFromTrackIds(
        req.accessToken,
        req.refreshToken,
        chunk,
        playlistTitle,
        description
      );

      createdPlaylists.push({
        id: newPlaylist.id,
        title: playlistTitle,
        permalink_url: newPlaylist.permalink_url,
        trackCount: chunk.length
      });

      if (i < numPlaylists - 1) await sleep(500);
    }

    res.json({
      playlists: createdPlaylists,
      totalTracks: trackIds.length,
      numPlaylistsCreated: numPlaylists
    });
    logOperation({
      userId: req.user.id,
      action: 'from-likes',
      trackCount: trackIds.length,
      status: 'split',
      playlistIds: createdPlaylists.map(p => p.id),
      trackIds,
    });
    piggybackEnrichment(trackIds, req.accessToken, req.refreshToken);
    invalidatePlaylistState(req.user.id);
    return;
  } catch (error) {
    logger.error('Create playlist from likes error:', safeError(error));
    res.status(500).json({ error: 'Failed to create playlist from likes' });
  }
});

/**
 * DELETE /api/playlists/:id
 * Delete a user-owned playlist via the SoundCloud API
 */
router.delete('/playlists/:id', authenticateUser, validateDeletePlaylist, async (req, res) => {
  try {
    const playlistId = req.params.id;
    await soundcloudClient.deletePlaylist(req.accessToken, req.refreshToken, playlistId);
    logOperation({ userId: req.user.id, action: 'delete-playlist', itemCount: 1, status: 'success', playlistIds: [playlistId] });
    invalidatePlaylistState(req.user.id);
    res.json({ ok: true });
  } catch (error) {
    logger.error('Delete playlist error:', safeError(error));
    const status = error?.status || error?.statusCode || 500;
    res.status(typeof status === 'number' && status >= 400 && status < 600 ? status : 500)
      .json({ error: 'Failed to delete playlist' });
  }
});

/**
 * GET /api/tracks/search
 * Search SoundCloud tracks by genre, tags, and other filters
 */
router.get('/tracks/search', authenticateUser, validateTrackSearch, async (req, res) => {
  try {
    const { genres, tags, q, bpm_from, bpm_to, duration_from, duration_to, limit, offset } = req.query;
    const params = {};
    if (genres) params.genres = genres;
    if (tags) params.tags = tags;
    if (q) params.q = q;
    if (bpm_from) params.bpm_from = Number(bpm_from);
    if (bpm_to) params.bpm_to = Number(bpm_to);
    if (duration_from) params.duration_from = Number(duration_from);
    if (duration_to) params.duration_to = Number(duration_to);
    params.limit = limit ? Math.min(Number(limit), 200) : 50;
    if (offset) params.offset = Number(offset);

    const data = await soundcloudClient.searchTracks(req.accessToken, req.refreshToken, params);
    harvestTracks(Array.isArray(data.collection) ? data.collection : []);
    const collection = (Array.isArray(data.collection) ? data.collection : [])
      .map(normalizeResource)
      .filter(Boolean);

    logOperation({
      userId: req.user.id,
      action: 'genre-search',
      itemCount: collection.length,
      status: 'success',
      trackIds: collection.map(t => t.id).filter(id => id != null),
      // The search intent itself is signal: what users look for, not just what they got
      metadata: {
        ...(genres ? { genres } : {}),
        ...(tags ? { tags } : {}),
        ...(q ? { q } : {}),
        ...(bpm_from ? { bpmFrom: Number(bpm_from) } : {}),
        ...(bpm_to ? { bpmTo: Number(bpm_to) } : {}),
      },
    });

    res.json({
      collection,
      next_href: data.next_href || null,
      total_results: data.total_results || null,
    });
  } catch (error) {
    logger.error('Track search error:', safeError(error));
    res.status(500).json({ error: 'Failed to search tracks' });
  }
});

/**
 * POST /api/playlists/deduplicate
 * Remove duplicates from a playlist
 */
// Smart Deduplication removed

/**
 * POST /api/resolve/batch
 * Resolve multiple SoundCloud URLs at once
 */
router.post('/resolve/batch', authenticateUser, heavyOperationRateLimiter, validateBatchResolve, async (req, res) => {
  try {
    const useV2 = isResolveV2(req);
    const { urls } = req.body;
    const results = [];
    // v1-normalized resources for logging + harvest, regardless of response version
    const resolvedResources = [];

    // Process sequentially to avoid SoundCloud rate limits
    for (let index = 0; index < urls.length; index += 1) {
      const rawUrl = urls[index];
      const url = sanitizeUrl(rawUrl);
      if (!url) {
        const invalidResult = { url: rawUrl, status: 'error', error: 'Invalid SoundCloud URL' };
        results.push(useV2 ? { ...invalidResult, index } : invalidResult);
        continue;
      }

      // Check cache first
      const cached = getCachedResolve(url);
      if (cached) {
        resolvedResources.push(cached);
        const cachedData = useV2 ? (normalizeResourceV2(cached) || cached) : cached;
        const okResult = { url: rawUrl, status: 'ok', data: cachedData };
        results.push(useV2 ? { ...okResult, index } : okResult);
        continue;
      }

      try {
        let resource;
        try {
          resource = await soundcloudClient.resolveAny(req.accessToken, req.refreshToken, url);
        } catch {
          resource = await soundcloudClient.resolvePublic(url);
        }
        const normalizedV1 = normalizeResource(resource);
        if (normalizedV1) {
          resolvedResources.push(normalizedV1);
          if (normalizedV1.type === 'track') harvestTracks([resource]);
          else if (normalizedV1.type === 'playlist') harvestPlaylists([resource]);
          setCachedResolve(url, normalizedV1);
          const payload = useV2 ? normalizeResourceV2(resource) : normalizedV1;
          const okResult = { url: rawUrl, status: 'ok', data: payload };
          results.push(useV2 ? { ...okResult, index } : okResult);
        } else {
          const badResult = { url: rawUrl, status: 'error', error: 'Could not parse resource' };
          results.push(useV2 ? { ...badResult, index } : badResult);
        }
      } catch (err) {
        const errorResult = { url: rawUrl, status: 'error', error: err.message || 'Resolve failed' };
        results.push(useV2 ? { ...errorResult, index } : errorResult);
      }
    }

    const failures = results.filter(r => r.status === 'error').length;
    const resolvedTrackIds = resolvedResources
      .filter(r => r?.type === 'track' && r.id != null)
      .map(r => r.id);
    const resolvedPlaylistIds = resolvedResources
      .filter(r => r?.type === 'playlist' && r.id != null)
      .map(r => r.id);
    if (!useV2) {
      res.json({ results });
    } else {
      res.json({
        results,
        summary: {
          total: results.length,
          ok: results.length - failures,
          error: failures
        },
        meta: {
          version: '2',
          resolved_at: nowIso()
        }
      });
    }
    logOperation({
      userId: req.user.id,
      action: 'batch-resolve',
      itemCount: urls.length,
      status: failures > 0 && failures === results.length ? 'error' : 'success',
      trackIds: resolvedTrackIds,
      playlistIds: resolvedPlaylistIds,
      errorCode: failures > 0 && failures === results.length ? 'ALL_ITEMS_FAILED' : undefined,
      errorMessage: failures > 0 && failures === results.length ? results.find(r => r.status === 'error')?.error : undefined,
      metadata: { total: results.length, succeeded: results.length - failures, failed: failures },
    });
  } catch (error) {
    logger.error('Batch resolve error:', safeError(error));
    res.status(500).json({ error: 'Batch resolve failed' });
  }
});

/**
 * GET /api/activities
 * Get the user's activity/stream feed
 */
router.get('/activities', authenticateUser, validateActivities, async (req, res) => {
  try {
    const limit = req.query.limit || 200;
    const payload = await getCachedUserPayload(
      'activities',
      req.user.id,
      `limit=${limit}`,
      async () => {
        const activities = await soundcloudClient.getActivities(req.accessToken, req.refreshToken, limit);
        logger.info(`[/api/activities] Fetched ${activities.length} raw activities`);

        const trackActivities = activities.map(item => {
          if (!item.origin || item.origin.kind !== 'track') return null;
          const normalized = normalizeResource(item.origin);
          if (!normalized || normalized.type !== 'track') return null;

          return {
            type: item.type,
            created_at: item.created_at,
            reposter: item.reposter || null,
            origin: {
              ...normalized,
              duration: normalized.duration_ms,
              user: {
                ...normalized.user,
                username: normalized.user?.username || normalized.username || 'Unknown User'
              }
            }
          };
        }).filter(Boolean);

        logger.info(`[/api/activities] Returning ${trackActivities.length} valid track activities`);
        harvestTracks(trackActivities.map(a => a.origin));
        return { collection: trackActivities };
      },
      CACHE_TTL.activities,
    );
    res.json(payload);
  } catch (error) {
    logger.error('Get activities error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/**
 * POST /api/likes/tracks/bulk-unlike
 * Unlike multiple tracks at once
 */
router.post('/likes/tracks/bulk-unlike', authenticateUser, heavyOperationRateLimiter, validateBulkUnlike, async (req, res) => {
  const elapsed = startOperationTimer();
  try {
    const { trackIds } = req.body;
    const results = [];

    // Process sequentially to avoid SoundCloud rate limits
    for (const trackId of trackIds) {
      try {
        await soundcloudClient.unlikeTrack(req.accessToken, req.refreshToken, trackId);
        results.push({ trackId, status: 'ok' });
      } catch (err) {
        results.push({ trackId, status: 'error', error: err.message || 'Unlike failed' });
      }
    }

    res.json({ results });
    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status !== 'ok').length;
    logOperation({
      userId: req.user.id,
      action: 'bulk-unlike',
      trackCount: succeeded,
      itemCount: results.length,
      status: failed > 0 && succeeded === 0 ? 'error' : 'success',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      trackIds: results.filter(r => r.status === 'ok').map(r => r.trackId),
      errorCode: failed > 0 && succeeded === 0 ? 'ALL_ITEMS_FAILED' : undefined,
      errorMessage: failed > 0 && succeeded === 0 ? results.find(r => r.status === 'error')?.error : undefined,
      metadata: { total: results.length, succeeded, failed },
    });
    // Invalidate AFTER identity is captured — the likes cache holds the full
    // track objects harvesting needs. Same tick as res.json, so no stale reads.
    const cachedLikes = requestCache.get('likes', req.user.id, 'default');
    if (Array.isArray(cachedLikes?.collection)) {
      const processed = new Set(trackIds);
      harvestTracks(cachedLikes.collection.filter(t => t && processed.has(t.id)));
    }
    invalidateUserNamespaces(req.user.id, ['likes']);
    // Cold-cache IDs still get names via enrichment (no-ops when already known)
    piggybackEnrichment(trackIds, req.accessToken, req.refreshToken);
  } catch (error) {
    logger.error('Bulk unlike error:', safeError(error));
    logOperation({
      userId: req.user.id,
      action: 'bulk-unlike',
      status: 'error',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      trackIds: Array.isArray(req.body?.trackIds) ? req.body.trackIds : undefined,
      errorCode: error.name || 'BULK_UNLIKE_FAILED',
      errorMessage: safeError(error).message,
    });
    res.status(500).json({ error: 'Bulk unlike failed' });
  }
});

/**
 * POST /api/likes/tracks/bulk-like
 * Like multiple tracks at once (e.g. "like every track in a playlist").
 * Capped at 100 per request; clients chunk larger sets.
 */
router.post('/likes/tracks/bulk-like', authenticateUser, heavyOperationRateLimiter, validateBulkLike, async (req, res) => {
  // Gentle pacing between writes — liking a full playlist is many rapid POSTs.
  const elapsed = startOperationTimer();
  try {
    const { trackIds } = req.body;
    const results = [];

    // Process sequentially to avoid SoundCloud rate limits.
    // NOTE: likeTrack is id-first (accessToken/refreshToken follow) — the
    // opposite of unlikeTrack. Getting this order wrong silently no-ops.
    for (const trackId of trackIds) {
      try {
        await soundcloudClient.likeTrack(trackId, req.accessToken, req.refreshToken);
        results.push({ trackId, status: 'ok' });
      } catch (err) {
        results.push({ trackId, status: 'error', error: err.message || 'Like failed' });
      }
      await sleep(150);
    }

    res.json({ results });
    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed = results.length - succeeded;
    logOperation({
      userId: req.user.id,
      action: 'bulk-like',
      trackCount: succeeded,
      itemCount: results.length,
      status: failed > 0 && succeeded === 0 ? 'error' : 'success',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      trackIds: results.filter(r => r.status === 'ok').map(r => r.trackId),
      errorCode: failed > 0 && succeeded === 0 ? 'ALL_ITEMS_FAILED' : undefined,
      errorMessage: failed > 0 && succeeded === 0 ? results.find(r => r.status === 'error')?.error : undefined,
      metadata: { total: results.length, succeeded, failed },
    });
    const cachedLikes = requestCache.get('likes', req.user.id, 'default');
    if (Array.isArray(cachedLikes?.collection)) {
      const processed = new Set(trackIds);
      harvestTracks(cachedLikes.collection.filter(t => t && processed.has(t.id)));
    }
    invalidateUserNamespaces(req.user.id, ['likes']);
    piggybackEnrichment(trackIds, req.accessToken, req.refreshToken);
  } catch (error) {
    logger.error('Bulk like error:', safeError(error));
    logOperation({
      userId: req.user.id,
      action: 'bulk-like',
      status: 'error',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      trackIds: Array.isArray(req.body?.trackIds) ? req.body.trackIds : undefined,
      errorCode: error.name || 'BULK_LIKE_FAILED',
      errorMessage: safeError(error).message,
    });
    res.status(500).json({ error: 'Bulk like failed' });
  }
});

/**
 * GET /api/followers
 * Get the user's followers list
 */
router.get('/followers', authenticateUser, async (req, res) => {
  try {
    const payload = await loadCachedFollowers(req);
    res.json(payload);
  } catch (error) {
    logger.error('Get followers error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

/**
 * GET /api/followings
 * Get the user's followings list
 */
router.get('/followings', authenticateUser, async (req, res) => {
  try {
    const payload = await loadCachedFollowings(req);
    res.json(payload);
  } catch (error) {
    logger.error('Get followings error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch followings' });
  }
});

/**
 * POST /api/followings/bulk-unfollow
 * Unfollow multiple users at once
 */
router.post('/followings/bulk-unfollow', authenticateUser, heavyOperationRateLimiter, validateBulkUnfollow, async (req, res) => {
  const elapsed = startOperationTimer();
  try {
    const { userIds } = req.body;
    const results = [];

    // Process sequentially to avoid SoundCloud rate limits
    for (const userId of userIds) {
      try {
        await soundcloudClient.unfollowUser(req.accessToken, req.refreshToken, userId);
        results.push({ userId, status: 'ok' });
      } catch (err) {
        results.push({ userId, status: 'error', error: err.message || 'Unfollow failed' });
      }
    }

    res.json({ results });
    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status !== 'ok').length;
    logOperation({
      userId: req.user.id,
      action: 'bulk-unfollow',
      itemCount: succeeded,
      status: failed > 0 && succeeded === 0 ? 'error' : 'success',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      targetUserIds: results.filter(r => r.status === 'ok').map(r => r.userId),
      errorCode: failed > 0 && succeeded === 0 ? 'ALL_ITEMS_FAILED' : undefined,
      errorMessage: failed > 0 && succeeded === 0 ? results.find(r => r.status === 'error')?.error : undefined,
      metadata: { total: results.length, succeeded, failed },
    });
    invalidateUserNamespaces(req.user.id, ['followings']);
  } catch (error) {
    logger.error('Bulk unfollow error:', safeError(error));
    logOperation({
      userId: req.user.id,
      action: 'bulk-unfollow',
      status: 'error',
      durationMs: elapsed(),
      clientInfo: extractClientInfo(req),
      targetUserIds: Array.isArray(req.body?.userIds) ? req.body.userIds : undefined,
      errorCode: error.name || 'BULK_UNFOLLOW_FAILED',
      errorMessage: safeError(error).message,
    });
    res.status(500).json({ error: 'Bulk unfollow failed' });
  }
});

/**
 * GET /api/reposts
 * Get the authenticated user's reposts (tracks + playlists) via activity feed.
 */
router.get('/reposts', authenticateUser, async (req, res) => {
  try {
    const payload = await getCachedUserPayload(
      'reposts',
      req.user.id,
      'default',
      async () => {
        const reposts = await soundcloudClient.getReposts(req.accessToken, req.refreshToken);
        logger.info(`[GET /api/reposts] returning ${reposts.length} reposts`);
        return { collection: reposts, total_results: reposts.length };
      },
      CACHE_TTL.reposts,
    );
    res.json(payload);
  } catch (error) {
    logger.error('Get reposts error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch reposts' });
  }
});

/**
 * GET /api/recently-played
 * Get the authenticated user's recently played tracks.
 */
router.get('/recently-played', authenticateUser, async (req, res) => {
  try {
    const payload = await getCachedUserPayload(
      'recently-played',
      req.user.id,
      'default',
      async () => {
        const recentlyPlayed = await soundcloudClient.getRecentlyPlayed(req.accessToken, req.refreshToken);
        logger.info(`[GET /api/recently-played] returning ${recentlyPlayed.length} tracks`);
        harvestTracks(recentlyPlayed);
        return { collection: recentlyPlayed };
      },
      60 * 1000 // 1 minute TTL
    );
    res.json(payload);
  } catch (error) {
    logger.error('Get recently played error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch recently played tracks' });
  }
});

/**
 * GET /api/users/:userUrn/related
 * Get related artists for a user.
 */
router.get('/users/:userUrn/related', authenticateUser, async (req, res) => {
  try {
    const { userUrn } = req.params;
    // userUrn can be a numeric ID or a soundcloud:users:123 format.
    // We trust soundcloudClient to handle either.
    const payload = await getCachedUserPayload(
      'related-artists',
      req.user.id,
      userUrn,
      async () => {
        const related = await soundcloudClient.getRelatedArtists(userUrn, req.accessToken, req.refreshToken);
        logger.info(`[GET /api/users/:userUrn/related] returning ${related.length} artists for ${userUrn}`);
        return { collection: related };
      },
      5 * 60 * 1000 // 5 minute TTL
    );
    res.json(payload);
  } catch (error) {
    logger.error('Get related artists error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch related artists' });
  }
});



/**
 * POST /api/reposts/bulk-remove
 * Remove multiple reposts at once.
 * Body: { items: Array<{ id: number; resourceType: 'track' | 'playlist' }> }
 */
router.post('/reposts/bulk-remove', authenticateUser, heavyOperationRateLimiter, validateBulkUnrepost, async (req, res) => {
  try {
    const { items } = req.body;
    const results = [];

    // Process sequentially to avoid SoundCloud rate limits
    for (const item of items) {
      try {
        await soundcloudClient.deleteRepost(req.accessToken, req.refreshToken, item.id, item.resourceType);
        results.push({ id: item.id, resourceType: item.resourceType, status: 'ok' });
      } catch (err) {
        results.push({ id: item.id, resourceType: item.resourceType, status: 'error', error: err.message || 'Remove failed' });
      }
    }

    res.json({ results });
    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed = results.length - succeeded;
    logOperation({
      userId: req.user.id,
      action: 'bulk-remove-reposts',
      itemCount: items.length,
      status: failed > 0 && succeeded === 0 ? 'error' : 'success',
      trackIds: results.filter(r => r.status === 'ok' && r.resourceType === 'track').map(r => r.id),
      playlistIds: results.filter(r => r.status === 'ok' && r.resourceType === 'playlist').map(r => r.id),
      errorCode: failed > 0 && succeeded === 0 ? 'ALL_ITEMS_FAILED' : undefined,
      errorMessage: failed > 0 && succeeded === 0 ? results.find(r => r.status === 'error')?.error : undefined,
      metadata: { total: results.length, succeeded, failed },
    });
    const cachedReposts = requestCache.get('reposts', req.user.id, 'default');
    if (Array.isArray(cachedReposts?.collection)) {
      const processedIds = new Set(items.map(i => i.id));
      // getReposts coerces missing titles to 'Unknown' — strip that so the
      // catalog row stays pending and enrichment fetches the real title
      const touched = cachedReposts.collection
        .filter(r => r && processedIds.has(r.id))
        .map(r => (r.title === 'Unknown' ? { ...r, title: null } : r));
      harvestTracks(touched.filter(r => r.resourceType === 'track'));
      harvestPlaylists(touched.filter(r => r.resourceType === 'playlist'));
    }
    invalidateUserNamespaces(req.user.id, ['reposts']);
    piggybackEnrichment(items.filter(i => i.resourceType === 'track').map(i => i.id), req.accessToken, req.refreshToken);
  } catch (error) {
    logger.error('Bulk unrepost error:', safeError(error));
    logOperation({
      userId: req.user.id,
      action: 'bulk-remove-reposts',
      status: 'error',
      trackIds: Array.isArray(req.body?.items)
        ? req.body.items.filter(i => i?.resourceType === 'track').map(i => i.id)
        : undefined,
      errorCode: error.name || 'BULK_UNREPOST_FAILED',
      errorMessage: safeError(error).message,
    });
    res.status(500).json({ error: 'Bulk unrepost failed' });
  }
});


/**
 * GET /api/users/:id/profile
 * Get any user's profile
 */
router.get('/users/:id/profile', authenticateUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const profile = await soundcloudClient.getUserProfile(id, req.accessToken, req.refreshToken);
    res.json(profile);
  } catch (error) {
    logger.error(`Get user profile error for ${req.params.id}:`, safeError(error));
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * GET /api/users/:id/tracks
 * Get any user's tracks
 */
router.get('/users/:id/tracks', authenticateUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const tracks = await soundcloudClient.getUserTracks(id, req.accessToken, req.refreshToken, limit);
    res.json({ collection: tracks });
  } catch (error) {
    logger.error(`Get user tracks error for ${req.params.id}:`, safeError(error));
    res.status(500).json({ error: 'Failed to fetch user tracks' });
  }
});

/**
 * POST /api/growth/discover
 * Discover suggested follow candidates
 */
router.post('/growth/discover', authenticateUser, heavyOperationRateLimiter, validateGrowthDiscover, async (req, res) => {
  try {
    const { inspirationUserIds, limit, strategy } = req.body;

    // Never resurface anyone previously targeted (including reversed follows)
    // and preload the auth user's own lists through the shared request cache
    // (a page load of the growth tool has usually warmed the followings entry).
    const [priorTargets, followingsPayload, followersPayload] = await Promise.all([
      prisma.growthAction.findMany({
        where: { userId: req.user.id, actionType: 'follow' },
        select: { targetId: true },
        distinct: ['targetId'],
      }),
      loadCachedFollowings(req).catch(() => null),
      loadCachedFollowers(req).catch(() => null),
    ]);

    const result = await growthEngine.discoverSuggestions({
      inspirationUserIds,
      authUserId: req.user.id,
      authSoundCloudId: req.user.soundcloudId,
      accessToken: req.accessToken,
      refreshToken: req.refreshToken,
      strategy,
      limit,
      excludedTargetIds: priorTargets.map((t) => Number(t.targetId)),
      // On a preload failure the engine falls back to fetching these itself
      authFollowingIds: followingsPayload ? followingsPayload.collection.map((u) => u.id) : null,
      authFollowerIds: followersPayload ? followersPayload.collection.map((u) => u.id) : null,
    });
    res.json(result);
    logOperation({
      userId: req.user.id,
      action: 'growth-discover',
      itemCount: result?.suggestions?.length ?? 0,
      status: 'success',
      targetUserIds: (result?.suggestions ?? []).map(s => s.user?.id).filter(id => id != null),
      trackIds: (result?.suggestions ?? []).map(s => s.suggestedTrack?.id).filter(id => id != null),
      metadata: { inspirationUserIds },
    });
  } catch (error) {
    logger.error('Growth discover error:', safeError(error));
    res.status(500).json({ error: 'Failed to run growth discovery' });
  }
});

/**
 * POST /api/events
 * Lightweight feature-usage event. Records a "user opened feature X" signal
 * into the operation log (namespaced `view:<feature>`) for internal product
 * analytics. No SoundCloud content or request metadata is recorded.
 */
router.post('/events', authenticateUser, validateEvent, async (req, res) => {
  // Fire-and-forget; never block or fail the client.
  void logOperation({
    userId: req.user.id,
    action: `view:${req.body.feature}`,
    status: 'success',
  });
  res.status(204).end();
});

/**
 * GET /api/growth/limits
 * Daily follow budget and session cooldown for the current user
 */
router.get('/growth/limits', authenticateUser, async (req, res) => {
  try {
    const budget = await getGrowthBudget(prisma, req.user.id);
    res.json(budget);
  } catch (error) {
    logger.error('Get growth limits error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch growth limits' });
  }
});

/**
 * POST /api/growth/engage
 * Start a paced background engagement batch (follow + optional like).
 * Server enforces the daily follow cap and session cooldown.
 */
router.post('/growth/engage', authenticateUser, heavyOperationRateLimiter, validateGrowthEngageBatch, async (req, res) => {
  try {
    const { targets, likeTracks, sessionLabel, inspirationIds, inspirationNames } = req.body;

    const budget = await getGrowthBudget(prisma, req.user.id);
    if (budget.remaining <= 0) {
      return res.status(429).json({
        error: `Daily follow limit reached (${budget.dailyCap} per 24h). Try again later.`,
        budget,
      });
    }
    if (budget.cooldownRemainingMs > 0) {
      const mins = Math.ceil(budget.cooldownRemainingMs / 60000);
      return res.status(429).json({
        error: `Session cooldown active. You can start a new batch in ${mins} minute${mins === 1 ? '' : 's'}.`,
        budget,
      });
    }
    if (targets.length > budget.remaining) {
      return res.status(400).json({
        error: `Only ${budget.remaining} follows remaining in your daily budget. Select ${budget.remaining} or fewer users.`,
        budget,
      });
    }

    const job = startEngagementJob(growthEngine, {
      prisma,
      userId: req.user.id,
      accessToken: req.accessToken,
      refreshToken: req.refreshToken,
      targets,
      likeTracks,
      sessionLabel,
      inspirationIds,
      inspirationNames,
    });

    invalidateUserNamespaces(req.user.id, ['followings', 'likes']);
    res.status(202).json({ job: serializeJob(job), budget });
    logOperation({
      userId: req.user.id,
      action: 'growth-engage-start',
      itemCount: targets.length,
      status: 'success',
      targetUserIds: targets.map(t => t.userId),
      trackIds: targets.filter(t => t.likeTrackId).map(t => t.likeTrackId),
    });
  } catch (error) {
    if (error.code === 'JOB_RUNNING') {
      return res.status(409).json({ error: 'An engagement batch is already running.' });
    }
    logger.error('Growth engage error:', safeError(error));
    res.status(500).json({ error: 'Failed to start engagement batch' });
  }
});

/**
 * GET /api/growth/engage/status
 * Progress of the current (or most recent) engagement batch
 */
router.get('/growth/engage/status', authenticateUser, (req, res) => {
  const job = getEngagementJob(req.user.id);
  res.json({ job: serializeJob(job) });
});

/**
 * POST /api/growth/engage/cancel
 * Request cancellation of the running engagement batch
 */
router.post('/growth/engage/cancel', authenticateUser, (req, res) => {
  const cancelled = cancelEngagementJob(req.user.id);
  res.json({ cancelled });
});

/**
 * GET /api/growth/analytics
 * Per-seed conversion rates and follow-back timing buckets
 */
router.get('/growth/analytics', authenticateUser, async (req, res) => {
  try {
    const follows = await prisma.growthAction.findMany({
      where: { userId: req.user.id, actionType: 'follow' },
      select: {
        targetId: true,
        followedBack: true,
        checkedAt: true,
        createdAt: true,
        inspirationIds: true,
        inspirationNames: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    // Per-seed conversion (each follow attributes to every seed in its session)
    const seedMap = new Map(); // seedId -> { seedId, name, follows, followedBack, checked }
    for (const f of follows) {
      if (!f.inspirationIds) continue;
      const ids = f.inspirationIds.split(',').map((x) => x.trim()).filter(Boolean);
      const names = (f.inspirationNames || '').split(',').map((x) => x.trim());
      ids.forEach((id, idx) => {
        if (!seedMap.has(id)) {
          seedMap.set(id, { seedId: id, name: names[idx] || `User ${id}`, follows: 0, followedBack: 0, checked: 0 });
        }
        const entry = seedMap.get(id);
        entry.follows++;
        if (f.followedBack !== null) {
          entry.checked++;
          if (f.followedBack === true) entry.followedBack++;
        }
        // Prefer a real name if a later record has one
        if (names[idx] && entry.name.startsWith('User ')) entry.name = names[idx];
      });
    }
    const perSeed = Array.from(seedMap.values())
      .map((s) => ({ ...s, rate: s.checked > 0 ? s.followedBack / s.checked : null }))
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    // Follow-back timing buckets (days between follow and confirmation check)
    const curve = [
      { bucket: '0-3 days', followedBack: 0, notFollowedBack: 0 },
      { bucket: '4-7 days', followedBack: 0, notFollowedBack: 0 },
      { bucket: '8-14 days', followedBack: 0, notFollowedBack: 0 },
      { bucket: '15+ days', followedBack: 0, notFollowedBack: 0 },
    ];
    for (const f of follows) {
      if (f.followedBack === null || !f.checkedAt) continue;
      const days = (new Date(f.checkedAt).getTime() - new Date(f.createdAt).getTime()) / 86400000;
      const idx = days <= 3 ? 0 : days <= 7 ? 1 : days <= 14 ? 2 : 3;
      if (f.followedBack) curve[idx].followedBack++;
      else curve[idx].notFollowedBack++;
    }

    res.json({ perSeed, followBackCurve: curve, totalFollows: follows.length });
  } catch (error) {
    logger.error('Get growth analytics error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch growth analytics' });
  }
});

/**
 * GET /api/growth/history
 * Fetch past growth actions
 */
router.get('/growth/history', authenticateUser, async (req, res) => {
  try {
    const { actionType, followedBack, reversed, sessionId } = req.query;

    const whereClause = { userId: req.user.id };

    if (actionType) whereClause.actionType = actionType;
    if (reversed) whereClause.reversed = reversed === 'true';
    if (sessionId) whereClause.sessionId = sessionId;

    if (followedBack) {
      if (followedBack === 'unchecked') {
        whereClause.followedBack = null;
      } else {
        whereClause.followedBack = followedBack === 'true';
      }
    }

    const actions = await prisma.growthAction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Fetch and aggregate session groups
    const allActionsForSessions = await prisma.growthAction.findMany({
      where: { userId: req.user.id },
      select: {
        sessionId: true,
        sessionLabel: true,
        actionType: true,
        followedBack: true,
        reversed: true,
        createdAt: true,
      },
    });

    const sessionGroupsMap = new Map();
    for (const act of allActionsForSessions) {
      if (!act.sessionId) continue;
      if (!sessionGroupsMap.has(act.sessionId)) {
        sessionGroupsMap.set(act.sessionId, {
          sessionId: act.sessionId,
          label: act.sessionLabel || 'Unnamed Session',
          date: act.createdAt,
          totalActions: 0,
          followedBack: 0,
          notFollowedBack: 0,
          unchecked: 0,
          reversed: 0,
        });
      }

      const s = sessionGroupsMap.get(act.sessionId);
      s.totalActions++;
      if (act.reversed) {
        s.reversed++;
      } else if (act.actionType === 'follow') {
        if (act.followedBack === true) s.followedBack++;
        else if (act.followedBack === false) s.notFollowedBack++;
        else s.unchecked++;
      }
      
      // Keep earliest/latest date?
      if (act.createdAt > s.date) s.date = act.createdAt;
    }

    const sessions = Array.from(sessionGroupsMap.values()).sort((a, b) => b.date - a.date);

    res.json({ actions, sessions });
  } catch (error) {
    logger.error('Get growth history error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch growth history' });
  }
});

/**
 * POST /api/growth/check-followbacks
 * Check reciprocation rate against the current followers list
 */
router.post('/growth/check-followbacks', authenticateUser, heavyOperationRateLimiter, validateGrowthCheckFollowbacks, async (req, res) => {
  try {
    const { sessionId } = req.body;

    logger.info(`[check-followbacks] Fetching current followers list for user ${req.user.id}`);
    const followers = await soundcloudClient.getFollowers(req.accessToken, req.refreshToken);
    const followerIds = new Set(followers.map(f => f.id));
    logger.info(`[check-followbacks] Found ${followerIds.size} total followers on SoundCloud`);

    const whereClause = {
      userId: req.user.id,
      actionType: 'follow',
      reversed: false,
    };
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const unreversedFollows = await prisma.growthAction.findMany({
      where: whereClause,
    });

    let checked = 0;
    let followedBack = 0;
    let didNotFollowBack = 0;
    let alreadyChecked = 0;
    const results = [];

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    for (const action of unreversedFollows) {
      // Cooldown: skip checking if checked in the last 24 hours and already checked
      if (action.checkedAt && (Date.now() - new Date(action.checkedAt).getTime() < ONE_DAY_MS) && action.followedBack !== null) {
        alreadyChecked++;
        continue;
      }

      const isFollowingBack = followerIds.has(Number(action.targetId));
      
      await prisma.growthAction.update({
        where: { id: action.id },
        data: {
          followedBack: isFollowingBack,
          checkedAt: new Date(),
        },
      });

      results.push({
        actionId: action.id,
        targetId: Number(action.targetId),
        targetName: action.targetName,
        followedBack: isFollowingBack,
      });

      checked++;
      if (isFollowingBack) followedBack++;
      else didNotFollowBack++;
    }

    invalidateUserNamespaces(req.user.id, ['followers']);

    res.json({
      checked,
      followedBack,
      didNotFollowBack,
      alreadyChecked,
      results,
    });
    logOperation({
      userId: req.user.id,
      action: 'growth-check-followbacks',
      itemCount: checked,
      status: 'success',
      targetUserIds: results.map(r => Number(r.targetId)).filter(n => !isNaN(n)),
      metadata: { followedBack, didNotFollowBack, alreadyChecked },
    });
  } catch (error) {
    logger.error('Check followbacks error:', safeError(error));
    res.status(500).json({ error: 'Failed to check followbacks' });
  }
});

/**
 * POST /api/growth/reverse
 * Unfollow and/or unlike targeted growth actions
 */
router.post('/growth/reverse', authenticateUser, validateReverseGrowthActions, async (req, res) => {
  try {
    const { actionIds, filter } = req.body;
    let targets = [];

    if (actionIds) {
      targets = await prisma.growthAction.findMany({
        where: {
          id: { in: actionIds },
          userId: req.user.id,
          reversed: false,
        },
      });
    } else if (filter) {
      const whereClause = {
        userId: req.user.id,
        reversed: false,
      };
      if (filter.sessionId) whereClause.sessionId = filter.sessionId;
      if (filter.actionType) whereClause.actionType = filter.actionType;
      
      if (filter.followedBack !== undefined) {
        whereClause.followedBack = filter.followedBack;
      }

      targets = await prisma.growthAction.findMany({
        where: whereClause,
      });
    }

    logger.info(`[reverse] Initiating reversal of ${targets.length} growth actions`);
    const results = [];
    let reversed = 0;
    let failed = 0;

    for (const action of targets) {
      try {
        if (action.actionType === 'follow') {
          await soundcloudClient.unfollowUser(req.accessToken, req.refreshToken, action.targetId);
        } else if (action.actionType === 'like') {
          await soundcloudClient.unlikeTrack(req.accessToken, req.refreshToken, action.targetId);
        }

        await prisma.growthAction.update({
          where: { id: action.id },
          data: {
            reversed: true,
            reversedAt: new Date(),
          },
        });

        results.push({ actionId: action.id, targetId: action.targetId, status: 'reversed' });
        reversed++;
      } catch (err) {
        logger.error(`Failed to reverse growth action ${action.id}:`, safeError(err));
        results.push({ actionId: action.id, targetId: action.targetId, status: 'error', error: 'Reversal failed' });
        failed++;
      }
      // sequential delay
      await sleep(SC_WRITE_PACING_MS);
    }

    invalidateUserNamespaces(req.user.id, ['followings', 'likes']);

    res.json({
      reversed,
      failed,
      results,
    });
    // 'partial' (not 'split') for partial failures — 'split' means playlist auto-splitting.
    logOperation({
      userId: req.user.id,
      action: 'growth-reverse',
      itemCount: targets.length,
      status: failed === 0 ? 'success' : (reversed > 0 ? 'partial' : 'error'),
      targetUserIds: targets.filter(t => t.actionType === 'follow' && results.some(r => r.actionId === t.id && r.status === 'reversed')).map(t => t.targetId),
      trackIds: targets.filter(t => t.actionType === 'like' && results.some(r => r.actionId === t.id && r.status === 'reversed')).map(t => t.targetId),
      errorCode: failed > 0 && reversed === 0 ? 'ALL_ITEMS_FAILED' : undefined,
      metadata: { total: targets.length, succeeded: reversed, failed },
    });
  } catch (error) {
    logger.error('Reverse growth actions error:', safeError(error));
    res.status(500).json({ error: 'Reversal operation failed' });
  }
});

/**
 * GET /api/growth/stats
 * Stats summary of growth features
 */
router.get('/growth/stats', authenticateUser, async (req, res) => {
  try {
    const totalFollowed = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'follow' },
    });
    const totalLiked = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'like' },
    });
    const followedBackCount = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'follow', followedBack: true },
    });
    const didNotFollowBackCount = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'follow', followedBack: false },
    });
    const activeFollows = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'follow', reversed: false },
    });
    const reversedFollows = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'follow', reversed: true },
    });
    const uncheckedFollows = await prisma.growthAction.count({
      where: { userId: req.user.id, actionType: 'follow', followedBack: null },
    });

    const totalFollowsChecked = followedBackCount + didNotFollowBackCount;
    const followedBackRate = totalFollowsChecked > 0 ? (followedBackCount / totalFollowsChecked) : 0;

    res.json({
      totalFollowed,
      totalLiked,
      followedBackRate,
      activeFollows,
      reversedFollows,
      uncheckedFollows,
    });
  } catch (error) {
    logger.error('Get growth stats error:', safeError(error));
    res.status(500).json({ error: 'Failed to fetch growth stats' });
  }
});


export default router;
