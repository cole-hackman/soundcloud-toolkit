import express from 'express';
import { unsignSession, parseSessionData } from '../lib/session.js';
import { decrypt } from '../lib/crypto.js';
import { soundcloudClient } from '../lib/soundcloud-client.js';
import prisma from '../lib/prisma.js';

const router = express.Router();

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
    res.json(playlists);
  } catch (error) {
    console.error('Get playlists error:', error);
    res.status(500).json({ error: 'Failed to get playlists' });
  }
});

/**
 * GET /api/likes
 * Get user's liked tracks
 */
router.get('/likes', authenticateUser, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const likes = await soundcloudClient.getLikes(
      req.accessToken,
      req.refreshToken,
      parseInt(limit),
      parseInt(offset)
    );
    res.json(likes);
  } catch (error) {
    console.error('Get likes error:', error);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

/**
 * POST /api/resolve
 * Resolve a SoundCloud URL
 */
router.post('/resolve', authenticateUser, async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const resolved = await soundcloudClient.resolveUrl(req.accessToken, req.refreshToken, url);
    res.json(resolved);
  } catch (error) {
    console.error('Resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
});

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

    // Get all tracks from source playlists
    const allTracks = [];
    const trackIds = new Set(); // For deduplication
    
    for (const playlistId of sourcePlaylistIds) {
      const playlist = await soundcloudClient.scRequest(
        `/playlists/${playlistId}`,
        req.accessToken,
        req.refreshToken
      );
      
      if (playlist.tracks) {
        for (const track of playlist.tracks) {
          if (!trackIds.has(track.id)) {
            trackIds.add(track.id);
            allTracks.push(track);
          }
        }
      }
    }

    // Create new playlist
    const playlistTitle = title || `Merged Playlist - ${new Date().toLocaleDateString()}`;
    const newPlaylist = await soundcloudClient.createPlaylist(
      req.accessToken,
      req.refreshToken,
      playlistTitle,
      `Merged from ${sourcePlaylistIds.length} playlists`
    );

    // Add tracks to new playlist
    const trackIdsArray = Array.from(trackIds);
    const updatedPlaylist = await soundcloudClient.addTracksToPlaylist(
      req.accessToken,
      req.refreshToken,
      newPlaylist.id,
      trackIdsArray
    );

    res.json({
      playlist: updatedPlaylist,
      totalTracks: trackIdsArray.length,
      sourcePlaylists: sourcePlaylistIds.length
    });
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
    const { title } = req.body;
    
    // Get all liked tracks
    const allLikes = await soundcloudClient.paginate(
      '/me/favorites',
      req.accessToken,
      req.refreshToken
    );

    const trackIds = allLikes.map(like => like.track.id);

    // Create new playlist
    const playlistTitle = title || `My Liked Tracks - ${new Date().toLocaleDateString()}`;
    const newPlaylist = await soundcloudClient.createPlaylist(
      req.accessToken,
      req.refreshToken,
      playlistTitle,
      `Playlist created from ${trackIds.length} liked tracks`
    );

    // Add tracks to new playlist
    const updatedPlaylist = await soundcloudClient.addTracksToPlaylist(
      req.accessToken,
      req.refreshToken,
      newPlaylist.id,
      trackIds
    );

    res.json({
      playlist: updatedPlaylist,
      totalTracks: trackIds.length
    });
  } catch (error) {
    console.error('Create playlist from likes error:', error);
    res.status(500).json({ error: 'Failed to create playlist from likes' });
  }
});

/**
 * POST /api/playlists/deduplicate
 * Remove duplicates from a playlist
 */
router.post('/playlists/deduplicate', authenticateUser, async (req, res) => {
  try {
    const { playlistId, confirm = false } = req.body;
    
    if (!playlistId) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    // Get playlist with tracks
    const playlist = await soundcloudClient.scRequest(
      `/playlists/${playlistId}`,
      req.accessToken,
      req.refreshToken
    );

    if (!playlist.tracks) {
      return res.status(400).json({ error: 'Playlist has no tracks' });
    }

    // Find duplicates
    const trackMap = new Map();
    const duplicates = [];
    const uniqueTracks = [];

    for (const track of playlist.tracks) {
      if (trackMap.has(track.id)) {
        duplicates.push(track);
      } else {
        trackMap.set(track.id, track);
        uniqueTracks.push(track);
      }
    }

    if (!confirm) {
      // Return preview of duplicates
      return res.json({
        preview: true,
        originalCount: playlist.tracks.length,
        uniqueCount: uniqueTracks.length,
        duplicateCount: duplicates.length,
        duplicates: duplicates.slice(0, 10) // Show first 10 duplicates
      });
    }

    // Actually remove duplicates
    const uniqueTrackIds = uniqueTracks.map(track => track.id);
    const updatedPlaylist = await soundcloudClient.addTracksToPlaylist(
      req.accessToken,
      req.refreshToken,
      playlistId,
      uniqueTrackIds
    );

    res.json({
      preview: false,
      playlist: updatedPlaylist,
      originalCount: playlist.tracks.length,
      uniqueCount: uniqueTracks.length,
      duplicateCount: duplicates.length,
      removedDuplicates: duplicates.length
    });
  } catch (error) {
    console.error('Deduplicate error:', error);
    res.status(500).json({ error: 'Failed to deduplicate playlist' });
  }
});

export default router;
