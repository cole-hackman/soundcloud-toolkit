import express from 'express';
import { unsignSession, parseSessionData } from '../lib/session.js';
import { decrypt } from '../lib/crypto.js';
import { soundcloudClient } from '../lib/soundcloud-client.js';
import prisma from '../lib/prisma.js';

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
      artwork_url: resource.artwork_url || resource.user?.avatar_url
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

// Middleware to authenticate requests
async function authenticateUser(req, res, next) {
  try {
    const sessionCookie = req.cookies.session;
    
    if (!sessionCookie) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const sessionValue = unsignSession(sessionCookie, process.env.SESSION_SECRET);
    if (!sessionValue) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const sessionData = parseSessionData(sessionValue);
    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid session data' });
    }

    // Get user and tokens from database
    const user = await prisma.user.findUnique({
      where: { id: sessionData.userId },
      include: { tokens: true }
    });

    if (!user || !user.tokens.length) {
      return res.status(401).json({ error: 'User not found or no tokens' });
    }

    const token = user.tokens[0];
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    // Decrypt tokens
    const accessToken = decrypt(token.encrypted, encryptionKey);
    const refreshToken = decrypt(token.refresh, encryptionKey);

    req.user = user;
    req.accessToken = accessToken;
    req.refreshToken = refreshToken;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * GET /api/me
 * Get current user information
 */
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const userInfo = await soundcloudClient.getMe(req.accessToken, req.refreshToken);
    res.json(userInfo);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * GET /api/playlists
 * Get user's playlists
 */
router.get('/playlists', authenticateUser, async (req, res) => {
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
          coverUrl = first?.artwork_url || '';
        } catch {}
      }
      if (!coverUrl) coverUrl = p.user?.avatar_url || '';
      return { ...p, id: idNum, coverUrl };
    }));
    res.json(withCovers);
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Failed to get playlists' });
  }
});

/**
 * GET /api/playlists/:id
 * Return single playlist with tracks included
 */
router.get('/playlists/:id', authenticateUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid playlist id' });
    const playlist = await soundcloudClient.getPlaylistWithTracks(
      req.accessToken,
      req.refreshToken,
      id
    );
    res.json(playlist);
  } catch (error) {
    console.error('Get playlist with tracks error:', error);
    res.status(500).json({ error: 'Failed to get playlist' });
  }
});

/**
 * PUT /api/playlists/:id
 * Update playlist order/title by sending full track list
 * Body: { tracks: number[]; title?: string }
 */
router.put('/playlists/:id', authenticateUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid playlist id' });
    const { tracks, title } = req.body || {};
    if (!Array.isArray(tracks)) return res.status(400).json({ error: 'tracks must be an array' });
    if (tracks.length > 500) return res.status(400).json({ error: 'Max 500 tracks' });

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
    console.error('Update playlist error:', error);
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
    console.error('Get likes error:', error);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

/**
 * GET /api/likes/paged
 * Returns one page of likes with cursor-based pagination
 * Query: limit (default 50), next (optional next_href from previous page)
 */
router.get('/likes/paged', authenticateUser, async (req, res) => {
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
    console.error('Get likes paged error:', error);
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
    const cleaned = sanitizeUrl(rawUrl);
    if (!cleaned) return res.status(400).json({ error: 'Invalid SoundCloud URL' });

    const now = Date.now();
    const cached = resolveCache.get(cleaned);
    if (cached && cached.expiresAt > now) {
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
  } catch (error) {
    console.error('Resolve error:', error);
    const msg = String(error?.message || '').toLowerCase();
    if (msg.includes('invalid_grant')) return res.status(401).json({ error: 'Session expired. Please log in again.' });
    if (msg.includes('401')) return res.status(401).json({ error: 'Unauthorized to resolve this URL. Sign in and try again.' });
    if (msg.includes('404')) return res.status(404).json({ error: 'Resource not found or private.' });
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
}

router.post('/resolve', authenticateUser, handleResolve);
router.get('/resolve', authenticateUser, handleResolve);

/**
 * POST /api/playlists/merge
 * Merge multiple playlists
 */
router.post('/playlists/merge', authenticateUser, async (req, res) => {
  try {
    const { sourcePlaylistIds, title } = req.body;
    
    if (!sourcePlaylistIds || !Array.isArray(sourcePlaylistIds) || sourcePlaylistIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 playlist IDs are required' });
    }

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
      const filtered = all.filter(t => t && t.playback_count !== 0 && !t.blocked_at && t.streamable !== false);
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

        // Create playlist with initial batch up to 200 tracks
        const initialCount = Math.min(batch.length, 200);
        const initialBatch = batch.slice(0, initialCount);
        const newPlaylist = await soundcloudClient.createPlaylist(
          req.accessToken,
          req.refreshToken,
          playlistTitle,
          `Merged from ${sourcePlaylistIds.length} playlists${numPlaylists > 1 ? ` - Part ${i + 1} of ${numPlaylists}` : ''}`,
          initialBatch
        );

        console.log(`[merge] created playlist ${i + 1}/${numPlaylists}`, { id: newPlaylist.id, initialCount });
        await sleep(500);

        // If more remain, set the full list at once (overwrite semantics)
        let finalUpdateSucceeded = false;
        let finalCount = initialBatch.length;
        if (batch.length > initialBatch.length) {
          const attemptUpdate = async (attempt) => {
            try {
              const updated = await soundcloudClient.addTracksToPlaylist(
                req.accessToken,
                req.refreshToken,
                newPlaylist.id,
                batch
              );
              finalCount = Array.isArray(updated.tracks) ? updated.tracks.length : (updated.track_count || batch.length);
              finalUpdateSucceeded = true;
            } catch (e) {
              console.error(`[merge] playlist ${i + 1} final set attempt ${attempt} failed:`, e?.message || e);
              throw e;
            }
          };

          try {
            await attemptUpdate(1);
          } catch {
            await sleep(800);
            await attemptUpdate(2);
          }
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

      console.log('[merge] summary (multiple playlists)', {
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
    } else {
      // Original single playlist logic (when <= 500 tracks)
      
      // Create playlist with initial batch up to 200 tracks
      const playlistTitle = baseTitle;
      const initialCount = Math.min(trackIdsArray.length, 200);
      const initialBatch = trackIdsArray.slice(0, initialCount);
      const newPlaylist = await soundcloudClient.createPlaylist(
        req.accessToken,
        req.refreshToken,
        playlistTitle,
        `Merged from ${sourcePlaylistIds.length} playlists`,
        initialBatch
      );

      console.log('[merge] created playlist', { id: newPlaylist.id, initialCount });
      await sleep(500);

      // If more remain, set the full list at once (overwrite semantics)
      let finalUpdateSucceeded = false;
      let finalCount = initialBatch.length;
      if (trackIdsArray.length > initialBatch.length) {
        const attemptUpdate = async (attempt) => {
          try {
            const updated = await soundcloudClient.addTracksToPlaylist(
              req.accessToken,
              req.refreshToken,
              newPlaylist.id,
              trackIdsArray
            );
            finalCount = Array.isArray(updated.tracks) ? updated.tracks.length : (updated.track_count || trackIdsArray.length);
            finalUpdateSucceeded = true;
          } catch (e) {
            console.error(`[merge] final set attempt ${attempt} failed:`, e?.message || e);
            throw e;
          }
        };

        try {
          await attemptUpdate(1);
        } catch {
          await sleep(800);
          await attemptUpdate(2);
        }
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

      console.log('[merge] summary', {
        sourceCount: sourcePlaylistIds.length,
        fetchedTotal,
        acceptedTotal,
        uniqueBeforeCap,
        totalTracks: trackIdsArray.length,
        createdId: newPlaylist.id,
        finalUpdateSucceeded,
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
    }
  } catch (error) {
    console.error('Merge playlists error:', error);
    res.status(500).json({ error: 'Failed to merge playlists' });
  }
});

/**
 * POST /api/playlists/from-likes
 * Create playlist from liked tracks
 */
router.post('/playlists/from-likes', authenticateUser, async (req, res) => {
  try {
    const { title, trackIds } = req.body;
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({ error: 'No tracks selected' });
    }
    if (trackIds.length > 500) {
      return res.status(400).json({ error: 'Max 500 tracks per playlist' });
    }

    const playlistTitle = title || `My Liked Tracks - ${new Date().toLocaleDateString()}`;
    const initialBatch = trackIds.slice(0, 200);
    const newPlaylist = await soundcloudClient.createPlaylist(
      req.accessToken,
      req.refreshToken,
      playlistTitle,
      `Playlist created from ${trackIds.length} liked tracks`,
      initialBatch
    );

    let index = 200;
    while (index < trackIds.length) {
      const batch = trackIds.slice(index, index + 200);
      await soundcloudClient.addTracksToPlaylist(
        req.accessToken,
        req.refreshToken,
        newPlaylist.id,
        batch
      );
      index += 200;
    }

    res.json({ playlistId: newPlaylist.id, permalink_url: newPlaylist.permalink_url, totalTracks: trackIds.length });
  } catch (error) {
    console.error('Create playlist from likes error:', error);
    res.status(500).json({ error: 'Failed to create playlist from likes' });
  }
});

/**
 * POST /api/playlists/deduplicate
 * Remove duplicates from a playlist
 */
// Smart Deduplication removed

export default router;
