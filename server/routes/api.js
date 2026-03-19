import express from 'express';
import { soundcloudClient } from '../lib/soundcloud-client.js';
import prisma from '../lib/prisma.js';
import { heavyOperationRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateUser } from '../middleware/auth.js';
import { logOperation } from '../lib/analytics.js';
import logger from '../lib/logger.js';
import {
  validatePlaylistId,
  validatePagination,
  validateResolve,
  validateMergePlaylists,
  validateUpdatePlaylist,
  validateCreateFromLikes,
  validateLikesPagination,
  validateBatchResolve,
  validateActivities,
  validateBulkUnlike,
  validateBulkUnfollow,
  validateBulkUnrepost,
} from '../middleware/validation.js';

const router = express.Router();

// Simple in-memory cache for resolve results (5 minutes TTL)
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const resolveCache = new Map(); // key: normalized input URL, value: { data, expiresAt }

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

function extractNumericId(maybe) {
  if (maybe == null) return undefined;
  if (typeof maybe === 'number') return maybe;
  if (typeof maybe === 'string') {
    const n = Number(maybe);
    if (!Number.isNaN(n)) return n;
    // try urn like soundcloud:tracks:123
    const m = maybe.match(/(tracks|playlists|users):(\d+)/);
    if (m) return Number(m[2]);
  }
  return undefined;
}

function normalizeResource(resource) {
  const kind = resource?.kind;
  if (kind === 'track') {
    const id = extractNumericId(resource.id || resource.urn);
    return {
      type: 'track',
      id,
      title: resource.title,
      user: { id: extractNumericId(resource.user?.id || resource.user?.urn), username: resource.user?.username },
      username: resource.user?.username,
      duration_ms: resource.duration,
      permalink_url: resource.permalink_url,
      artwork_url: resource.artwork_url || resource.user?.avatar_url,
      downloadable: resource.downloadable,
      download_url: resource.download_url,
      purchase_url: resource.purchase_url,
      purchase_title: resource.purchase_title
    };
  }
  if (kind === 'playlist') {
    const id = extractNumericId(resource.id || resource.urn);
    return {
      type: 'playlist',
      id,
      title: resource.title,
      user: { id: extractNumericId(resource.user?.id || resource.user?.urn), username: resource.user?.username },
      username: resource.user?.username,
      track_count: resource.track_count,
      permalink_url: resource.permalink_url,
      artwork_url: resource.artwork_url || resource.user?.avatar_url
    };
  }
  if (kind === 'user') {
    const id = extractNumericId(resource.id || resource.urn);
    return {
      type: 'user',
      id,
      username: resource.username,
      followers_count: resource.followers_count,
      permalink_url: resource.permalink_url,
      avatar_url: resource.avatar_url
    };
  }
  // Fallback heuristic
  if (resource.track) return normalizeResource({ ...resource.track, kind: 'track' });
  if (resource.playlist) return normalizeResource({ ...resource.playlist, kind: 'playlist' });
  if (resource.username) return normalizeResource({ ...resource, kind: 'user' });
  return null;
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
    logger.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * GET /api/playlists
 * Get user's playlists
 */
router.get('/playlists', authenticateUser, validatePagination, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const playlists = await soundcloudClient.getPlaylists(
      req.accessToken,
      req.refreshToken,
      parseInt(limit),
      parseInt(offset)
    );
    // Compute coverUrl with priority: playlist.artwork_url -> first track artwork -> playlist.user.avatar_url -> ''
    const withCovers = { ...playlists };
    withCovers.collection = await Promise.all((playlists.collection || []).map(async (p) => {
      // Normalize id to number for client selection stability
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
    res.json(withCovers);
  } catch (error) {
    logger.error('Get playlists error:', error);
    res.status(500).json({ error: 'Failed to get playlists' });
  }
});

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
    res.json(playlist);
  } catch (error) {
    logger.error('Get playlist with tracks error:', error);
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

    res.json(updated);
  } catch (error) {
    logger.error('Update playlist error:', error);
    res.status(500).json({ error: 'Failed to update playlist' });
  }
});

/**
 * GET /api/likes
 * Get user's liked tracks
 */
router.get('/likes', authenticateUser, async (req, res) => {
  try {
    // Return full likes list (linked_partitioning paginate)
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
    res.json({ collection: items, total_results: items.length });
  } catch (error) {
    logger.error('Get likes error:', error);
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
    res.json({
      collection: Array.isArray(page.collection) ? page.collection : [],
      next_href: page.next_href || null,
      total: page.total_results || undefined
    });
  } catch (error) {
    logger.error('Get likes paged error:', error);
    res.status(500).json({ error: 'Failed to get likes page' });
  }
});

/**
 * POST /api/resolve
 * Resolve a SoundCloud URL
 */
async function handleResolve(req, res) {
  try {
    const rawUrl = req.method === 'GET' ? req.query?.url : req.body?.url;
    // Validation middleware already checked the URL format
    const cleaned = sanitizeUrl(rawUrl);
    if (!cleaned) return res.status(400).json({ error: 'Invalid SoundCloud URL' });

    const now = Date.now();
    const cached = resolveCache.get(cleaned);
    if (cached && cached.expiresAt > now) {
      logOperation({ userId: req.user.id, action: 'resolve', status: 'success' });
      return res.json(cached.data);
    }

    let resource;
    try {
      resource = await soundcloudClient.resolveAny(req.accessToken, req.refreshToken, cleaned);
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      // If token is invalid/expired, try public resolve for public resources
      if (msg.includes('invalid_grant') || msg.includes('401')) {
        try {
          resource = await soundcloudClient.resolvePublic(cleaned);
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

    resolveCache.set(cleaned, { data: normalized, expiresAt: now + RESOLVE_CACHE_TTL_MS });
    res.json(normalized);
    logOperation({ userId: req.user.id, action: 'resolve', status: 'success' });
  } catch (error) {
    logger.error('Resolve error:', error);
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
 * Allow only SoundCloud API download URLs to prevent SSRF and token leakage.
 */
function isAllowedDownloadUrl(input) {
  if (!input || typeof input !== 'string') return false;
  const s = input.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    // Only allow SoundCloud API download endpoints
    if (host !== 'api.soundcloud.com' && !host.endsWith('.soundcloud.com')) return false;
    // Must look like a track download path: /tracks/:id/download or similar
    if (!/^\/tracks\/\d+\/download(\?|$)/.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

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

    const result = await soundcloudClient.getDownloadLink(req.accessToken, req.refreshToken, url);
    
    if (result && result.redirect) {
      // Only redirect to known SoundCloud CDN hosts to prevent open redirect
      const loc = result.redirect;
      try {
        const u = new URL(loc);
        const host = u.hostname.toLowerCase();
        const allowed =
          host === 'sndcdn.com' || host.endsWith('.sndcdn.com') ||
          host === 'cloudfront.net' || host.endsWith('.cloudfront.net') ||
          host === 'soundcloud.com' || host.endsWith('.soundcloud.com');
        if (u.protocol === 'https:' && allowed) {
          logOperation({ userId: req.user.id, action: 'proxy-download', status: 'success' });
          return res.redirect(loc);
        }
      } catch {}
      return res.status(502).json({ error: 'Invalid download redirect target' });
    }
    
    res.status(404).json({ error: 'Could not resolve download link' });
  } catch (error) {
    logger.error('Proxy download error:', error);
    res.status(500).json({ error: 'Failed to proxy download' });
  }
});

/**
 * POST /api/playlists/merge
 * Merge multiple playlists
 */
router.post('/playlists/merge', authenticateUser, heavyOperationRateLimiter, validateMergePlaylists, async (req, res) => {
  try {
    const { sourcePlaylistIds, title } = req.body;
    // Validation middleware already checked the input

    // Helper to slow down between API calls
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      fetchedTotal += all.length;
      acceptedTotal += filtered.length;
      perPlaylistCounts.push({ id: playlistId, fetched: all.length, accepted: filtered.length });
      for (const t of filtered) {
        if (t.id != null) trackIdSet.add(t.id);
      }
      await sleep(300); // small pause between playlist fetches
    }

    const uniqueBeforeCap = trackIdSet.size;
    const trackIdsArray = Array.from(trackIdSet);
    const baseTitle = title || `Merged Playlist - ${new Date().toLocaleDateString()}`;

    // If tracks exceed 500, split into multiple playlists
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

        // Create playlist with 100-track batches (SoundCloud API limit)
        const mergeBatchSize = 100;
        const initialBatch = batch.slice(0, mergeBatchSize);
        const newPlaylist = await soundcloudClient.createPlaylist(
          req.accessToken,
          req.refreshToken,
          playlistTitle,
          `Merged from ${sourcePlaylistIds.length} playlists${numPlaylists > 1 ? ` - Part ${i + 1} of ${numPlaylists}` : ''}\n\nCreated using SC Toolkit. Try it for free soundcloudtoolkit.com`,
          initialBatch
        );

        logger.info(`[merge] created playlist ${i + 1}/${numPlaylists}`, { id: newPlaylist.id, initialCount: initialBatch.length });
        await sleep(500);

        let finalCount = initialBatch.length;
        let addIndex = mergeBatchSize;
        while (addIndex < batch.length) {
          await sleep(300);
          const addBatch = batch.slice(0, addIndex + mergeBatchSize);
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

        createdPlaylists.push({
          playlist: newPlaylist,
          trackCount: verifiedCount,
          partNumber: i + 1
        });

        // Small delay between creating multiple playlists
        if (i < numPlaylists - 1) {
          await sleep(500);
        }
      }

      logger.info('[merge] summary (multiple playlists)', {
        sourceCount: sourcePlaylistIds.length,
        fetchedTotal,
        acceptedTotal,
        uniqueBeforeCap,
        totalTracks: trackIdsArray.length,
        numPlaylistsCreated: numPlaylists,
        playlists: createdPlaylists.map(p => ({ id: p.playlist.id, count: p.trackCount }))
      });

      res.json({
        playlists: createdPlaylists.map(p => p.playlist),
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
      logOperation({ userId: req.user.id, action: 'merge', trackCount: trackIdsArray.length, status: 'split' });
    } else {
      // Single playlist (<= 500 tracks) with 100-track batches
      const playlistTitle = baseTitle;
      const mergeBatchSize = 100;
      const initialBatch = trackIdsArray.slice(0, mergeBatchSize);
      const newPlaylist = await soundcloudClient.createPlaylist(
        req.accessToken,
        req.refreshToken,
        playlistTitle,
        `Merged from ${sourcePlaylistIds.length} playlists\n\nCreated using SC Toolkit. Try it for free soundcloudtoolkit.com`,
        initialBatch
      );

      logger.info('[merge] created playlist', { id: newPlaylist.id, initialCount: initialBatch.length });
      await sleep(500);

      let finalCount = initialBatch.length;
      let addIndex = mergeBatchSize;
      while (addIndex < trackIdsArray.length) {
        await sleep(300);
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
      logOperation({ userId: req.user.id, action: 'merge', trackCount: trackIdsArray.length, status: 'success' });
    }
  } catch (error) {
    logger.error('Merge playlists error:', error);
    res.status(500).json({ error: 'Failed to merge playlists' });
  }
});

const BATCH_SIZE_PLAYLIST_TRACKS = 100;
const MAX_TRACKS_PER_PLAYLIST = 500;

/**
 * Create a single playlist from track IDs using 100-track batches (SoundCloud API limit).
 */
async function createPlaylistFromTrackIds(accessToken, refreshToken, trackIds, title, description) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const initialBatch = trackIds.slice(0, BATCH_SIZE_PLAYLIST_TRACKS);
  const newPlaylist = await soundcloudClient.createPlaylist(
    accessToken,
    refreshToken,
    title,
    description,
    initialBatch
  );

  let index = BATCH_SIZE_PLAYLIST_TRACKS;
  while (index < trackIds.length) {
    await sleep(300);
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

/**
 * POST /api/playlists/from-likes
 * Create playlist(s) from liked tracks. Uses 100-track batches. If >500 tracks, creates multiple playlists.
 */
router.post('/playlists/from-likes', authenticateUser, heavyOperationRateLimiter, validateCreateFromLikes, async (req, res) => {
  try {
    const { title, trackIds } = req.body;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const baseTitle = title?.trim() || `My Liked Tracks - ${new Date().toLocaleDateString()}`;

    if (trackIds.length <= MAX_TRACKS_PER_PLAYLIST) {
      const newPlaylist = await createPlaylistFromTrackIds(
        req.accessToken,
        req.refreshToken,
        trackIds,
        baseTitle,
        `Playlist created from ${trackIds.length} liked tracks\n\nCreated using SC Toolkit. Try it for free soundcloudtoolkit.com`
      );
      res.json({
        playlistId: newPlaylist.id,
        permalink_url: newPlaylist.permalink_url,
        playlist: { id: newPlaylist.id, title: baseTitle, permalink_url: newPlaylist.permalink_url },
        totalTracks: trackIds.length
      });
      logOperation({ userId: req.user.id, action: 'from-likes', trackCount: trackIds.length, status: 'success' });
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
      const description = `Playlist created from liked tracks${numPlaylists > 1 ? ` - Part ${i + 1} of ${numPlaylists}` : ''}\n\nCreated using SC Toolkit. Try it for free soundcloudtoolkit.com`;

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
    logOperation({ userId: req.user.id, action: 'from-likes', trackCount: trackIds.length, status: 'split' });
    return;
  } catch (error) {
    logger.error('Create playlist from likes error:', error);
    res.status(500).json({ error: 'Failed to create playlist from likes' });
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
    const { urls } = req.body;
    const results = [];

    // Process sequentially to avoid SoundCloud rate limits
    for (const rawUrl of urls) {
      const url = sanitizeUrl(rawUrl);
      if (!url) {
        results.push({ url: rawUrl, status: 'error', error: 'Invalid SoundCloud URL' });
        continue;
      }

      // Check cache first
      const cached = resolveCache.get(url);
      if (cached && cached.expiresAt > Date.now()) {
        results.push({ url: rawUrl, status: 'ok', data: cached.data });
        continue;
      }

      try {
        let resource;
        try {
          resource = await soundcloudClient.resolveUrl(req.accessToken, req.refreshToken, url);
        } catch {
          resource = await soundcloudClient.resolvePublic(url);
        }
        const normalized = normalizeResource(resource);
        if (normalized) {
          resolveCache.set(url, { data: normalized, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS });
          results.push({ url: rawUrl, status: 'ok', data: normalized });
        } else {
          results.push({ url: rawUrl, status: 'error', error: 'Could not parse resource' });
        }
      } catch (err) {
        results.push({ url: rawUrl, status: 'error', error: err.message || 'Resolve failed' });
      }
    }

    const failures = results.filter(r => r.status === 'error').length;
    res.json({ results });
    logOperation({ userId: req.user.id, action: 'batch-resolve', itemCount: urls.length, status: 'success', metadata: { failures } });
  } catch (error) {
    logger.error('Batch resolve error:', error);
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
    const activities = await soundcloudClient.getActivities(req.accessToken, req.refreshToken, limit);

    // Filter to track-related activities and map to useful shape
    logger.info(`[/api/activities] Fetched ${activities.length} raw activities`);
    
    let trackCount = 0;
    const trackActivities = activities.map(item => {
      // Check for track origin
      if (!item.origin || item.origin.kind !== 'track') return null;
      
      // Normalize the items
      const normalized = normalizeResource(item.origin);
      if (!normalized || normalized.type !== 'track') return null;

      trackCount++;
      return {
        type: item.type,
        created_at: item.created_at,
        origin: {
          ...normalized,
          // Frontend expects 'duration', normalizeResource provides 'duration_ms'
          duration: normalized.duration_ms, 
          // Ensure user object has username for display
          user: {
            ...normalized.user,
            username: normalized.user?.username || normalized.username || 'Unknown User'
          }
        }
      };
    }).filter(Boolean);

    logger.info(`[/api/activities] Returning ${trackActivities.length} valid track activities`);
    res.json({ collection: trackActivities });
  } catch (error) {
    logger.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/**
 * POST /api/likes/tracks/bulk-unlike
 * Unlike multiple tracks at once
 */
router.post('/likes/tracks/bulk-unlike', authenticateUser, heavyOperationRateLimiter, validateBulkUnlike, async (req, res) => {
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
    logOperation({ userId: req.user.id, action: 'bulk-unlike', trackCount: results.filter(r => r.status === 'ok').length, itemCount: results.length, status: 'success' });
  } catch (error) {
    logger.error('Bulk unlike error:', error);
    res.status(500).json({ error: 'Bulk unlike failed' });
  }
});

/**
 * GET /api/followers
 * Get the user's followers list
 */
router.get('/followers', authenticateUser, async (req, res) => {
  try {
    const followers = await soundcloudClient.getFollowers(req.accessToken, req.refreshToken);
    res.json({ collection: followers, total: followers.length });
  } catch (error) {
    logger.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

/**
 * GET /api/followings
 * Get the user's followings list
 */
router.get('/followings', authenticateUser, async (req, res) => {
  try {
    const followings = await soundcloudClient.getFollowings(req.accessToken, req.refreshToken);
    res.json({ collection: followings, total: followings.length });
  } catch (error) {
    logger.error('Get followings error:', error);
    res.status(500).json({ error: 'Failed to fetch followings' });
  }
});

/**
 * POST /api/followings/bulk-unfollow
 * Unfollow multiple users at once
 */
router.post('/followings/bulk-unfollow', authenticateUser, heavyOperationRateLimiter, validateBulkUnfollow, async (req, res) => {
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
    logOperation({ userId: req.user.id, action: 'bulk-unfollow', itemCount: results.filter(r => r.status === 'ok').length, status: 'success' });
  } catch (error) {
    logger.error('Bulk unfollow error:', error);
    res.status(500).json({ error: 'Bulk unfollow failed' });
  }
});

/**
 * GET /api/reposts
 * Get the authenticated user's reposts (tracks + playlists) via activity feed.
 */
router.get('/reposts', authenticateUser, async (req, res) => {
  try {
    const reposts = await soundcloudClient.getReposts(req.accessToken, req.refreshToken);
    logger.info(`[GET /api/reposts] returning ${reposts.length} reposts`);
    res.json({ collection: reposts, total_results: reposts.length });
  } catch (error) {
    logger.error('Get reposts error:', error);
    res.status(500).json({ error: 'Failed to fetch reposts' });
  }
});

/**
 * GET /api/reposts/debug
 * Diagnostic endpoint — tests multiple SC API endpoints and returns raw results.
 * Navigate to /api/reposts/debug while logged in to diagnose repost fetching.
 */
router.get('/reposts/debug', authenticateUser, async (req, res) => {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const token = req.accessToken;
  const debug = {};

  // 1. Get SC user ID
  try {
    const me = await soundcloudClient.getMe(token, req.refreshToken);
    debug.userId = me?.id;
    debug.reposts_count = me?.reposts_count;
  } catch (e) {
    debug.userId = `ERROR: ${e.message}`;
  }

  // 2. Try v2 API stream/users/{id}/reposts
  try {
    const v2url = `https://api-v2.soundcloud.com/stream/users/${debug.userId}/reposts?limit=10&client_id=${clientId}`;
    const v2res = await fetch(v2url, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
    });
    const v2body = await v2res.text();
    let v2json = null;
    try { v2json = JSON.parse(v2body); } catch (_) { /* not json */ }
    debug.v2_reposts = {
      status: v2res.status,
      statusText: v2res.statusText,
      body: v2json ?? v2body.slice(0, 500),
      collection_length: v2json?.collection?.length ?? null,
    };
  } catch (e) {
    debug.v2_reposts = { error: e.message };
  }

  // 3. Try v2 API without client_id (just OAuth token)
  try {
    const v2url2 = `https://api-v2.soundcloud.com/stream/users/${debug.userId}/reposts?limit=10`;
    const v2res2 = await fetch(v2url2, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
    });
    const v2body2 = await v2res2.text();
    let v2json2 = null;
    try { v2json2 = JSON.parse(v2body2); } catch (_) { /* not json */ }
    debug.v2_reposts_no_clientid = {
      status: v2res2.status,
      statusText: v2res2.statusText,
      body: v2json2 ?? v2body2.slice(0, 500),
      collection_length: v2json2?.collection?.length ?? null,
    };
  } catch (e) {
    debug.v2_reposts_no_clientid = { error: e.message };
  }

  // 4. Try v1 /me/activities (first page only)
  try {
    const v1res = await fetch(`https://api.soundcloud.com/me/activities?limit=50`, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
    });
    const v1json = await v1res.json();
    const types = [...new Set((v1json.collection ?? []).map(i => i.type))];
    debug.v1_activities = {
      status: v1res.status,
      total_items: v1json.collection?.length ?? 0,
      unique_types: types,
      repost_items: (v1json.collection ?? []).filter(i => i.type?.includes('repost')).length,
    };
  } catch (e) {
    debug.v1_activities = { error: e.message };
  }

  // 5. Try v1 /me/activities/all/own (first page only)
  try {
    const v1own = await fetch(`https://api.soundcloud.com/me/activities/all/own?limit=50`, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
    });
    const v1ownjson = await v1own.json();
    const types2 = [...new Set((v1ownjson.collection ?? []).map(i => i.type))];
    debug.v1_activities_own = {
      status: v1own.status,
      total_items: v1ownjson.collection?.length ?? 0,
      unique_types: types2,
      repost_items: (v1ownjson.collection ?? []).filter(i => i.type?.includes('repost')).length,
    };
  } catch (e) {
    debug.v1_activities_own = { error: e.message };
  }

  res.json(debug);
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
    logOperation({ userId: req.user.id, action: 'bulk-remove-reposts', itemCount: items.length, status: 'success' });
  } catch (error) {
    logger.error('Bulk unrepost error:', error);
    res.status(500).json({ error: 'Bulk unrepost failed' });
  }
});

export default router;
