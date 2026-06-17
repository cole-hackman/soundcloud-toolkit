import dotenv from 'dotenv';
dotenv.config();
import { encrypt } from './crypto.js';
import logger from './logger.js';
import prisma from './prisma.js';
import { getTokenContext } from './token-context.js';

/**
 * Safely parse a fetch Response body as JSON.
 * Reads the body as text first so empty bodies (common for DELETEs, and for
 * SoundCloud hiccups that return empty 2xx responses) don't throw the opaque
 * "Unexpected end of JSON input" error. On a non-empty/unparseable body, logs the
 * real status plus a short snippet and throws a clear, sanitized error.
 */
async function parseScJson(response, { context = 'SoundCloud API', allowEmpty = true } = {}) {
  const text = await response.text();
  if (!text || text.trim() === '') {
    if (allowEmpty) return null;            // empty 2xx — fatal only where a body is required
    logger.warn(`[${context}] empty response body (status ${response.status})`);
    throw new Error(`${context}: empty response (status ${response.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    logger.warn(`[${context}] non-JSON response (status ${response.status}): ${snippet}`);
    throw new Error(`${context}: invalid JSON response (status ${response.status})`);
  }
}

class SoundCloudClient {
  constructor() {
    this.baseUrl = 'https://api.soundcloud.com';
    this.clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    this.clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
    this.redirectUri = process.env.SOUNDCLOUD_REDIRECT_URI;
    this.encryptionKey = process.env.ENCRYPTION_KEY;

    if (!this.clientId || !this.clientSecret || !this.redirectUri || !this.encryptionKey) {
      throw new Error('Missing required SoundCloud environment variables');
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code, codeVerifier) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
      code_verifier: codeVerifier
    });

    const response = await fetch('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error - don't include full response body which might contain tokens
      const sanitizedError = errorText.length > 200 
        ? errorText.substring(0, 200) + '...' 
        : errorText;
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return parseScJson(response, { context: 'Token exchange', allowEmpty: false });
  }

  /**
   * Refresh access tokens using refresh token
   */
  async refreshTokens(refreshToken) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken
    });

    const response = await fetch('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error - don't include full response body
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return parseScJson(response, { context: 'Token refresh', allowEmpty: false });
  }

  async refreshTokensAndPersist(refreshToken) {
    const newTokens = await this.refreshTokens(refreshToken);
    const context = getTokenContext();

    if (!context?.userId) {
      console.warn('Token refresh completed without user context; refreshed tokens were not persisted', {
        hasAccessToken: Boolean(newTokens.access_token),
        hasRefreshToken: Boolean(newTokens.refresh_token),
        expiresIn: newTokens.expires_in,
      });
      return newTokens;
    }

    if (newTokens.access_token && newTokens.refresh_token) {
      const expiresAt = new Date(Date.now() + ((newTokens.expires_in || 3600) * 1000));
      await prisma.token.update({
        where: { userId: context.userId },
        data: {
          encrypted: encrypt(newTokens.access_token, this.encryptionKey),
          refresh: encrypt(newTokens.refresh_token, this.encryptionKey),
          expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    return newTokens;
  }

  /**
   * Make authenticated request to SoundCloud API with automatic token refresh
   */
  async scRequest(endpoint, accessToken, refreshToken, options = {}) {
    const { max429Retries = 3, retryAttempt = 0, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Authorization': `OAuth ${accessToken}`,
        'Accept': 'application/json',
        ...fetchOptions.headers
      }
    });

    // Handle 401 - token expired, try to refresh
    if (response.status === 401) {
      try {
        const newTokens = await this.refreshTokensAndPersist(refreshToken);
        const newAccessToken = newTokens.access_token;

        // Retry the request with new token
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: {
            'Authorization': `OAuth ${newAccessToken}`,
            'Accept': 'application/json',
            ...fetchOptions.headers
          }
        });

        if (!retryResponse.ok) {
          // Don't include response body in error message
          throw new Error(`API request failed after token refresh: ${retryResponse.status}`);
        }

        return parseScJson(retryResponse, { context: endpoint });
      } catch (refreshError) {
        // Don't expose refresh error details
        throw new Error(`Token refresh failed`);
      }
    }

    // Handle 429 - rate limit, implement exponential backoff
    if (response.status === 429) {
      if (retryAttempt >= max429Retries) {
        throw new Error(`API request failed: 429`);
      }
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.scRequest(endpoint, accessToken, refreshToken, {
        ...fetchOptions,
        max429Retries,
        retryAttempt: retryAttempt + 1,
      });
    }

    if (!response.ok) {
      // Don't include response body in error message to prevent secret leakage
      throw new Error(`API request failed: ${response.status}`);
    }

    return parseScJson(response, { context: endpoint });
  }

  /**
   * Get current user information
   */
  async getMe(accessToken, refreshToken) {
    return this.scRequest('/me', accessToken, refreshToken);
  }

  /**
   * Get user's playlists with pagination
   */
  async getPlaylists(accessToken, refreshToken, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      linked_partitioning: '1'
    });

    return this.scRequest(`/me/playlists?${params.toString()}`, accessToken, refreshToken);
  }

  /**
   * Get a playlist with tracks included
   */
  async getPlaylistWithTracks(accessToken, refreshToken, playlistId) {
    return this.scRequest(`/playlists/${playlistId}?show_tracks=true`, accessToken, refreshToken);
  }

  /**
   * Get user's liked tracks with pagination
   */
  async getLikes(accessToken, refreshToken, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      linked_partitioning: '1'
    });

    // Prefer newer endpoint; fallback to older favorites
    try {
      return await this.scRequest(`/me/likes/tracks?${params.toString()}`, accessToken, refreshToken);
    } catch (e) {
      return this.scRequest(`/me/favorites?${params.toString()}`, accessToken, refreshToken);
    }
  }

  /**
   * Get all items from a paginated endpoint
   */
  async paginate(endpoint, accessToken, refreshToken, limit = 50) {
    const allItems = [];
    // Prefer cursor-based pagination via next_href to avoid deprecated offset limits
    let nextUrl = `${this.baseUrl}${endpoint}?${new URLSearchParams({
      limit: limit.toString(),
      linked_partitioning: '1'
    }).toString()}`;

    let currentAccessToken = accessToken;

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: {
          'Authorization': `OAuth ${currentAccessToken}`,
          'Accept': 'application/json'
        }
      });

      if (res.status === 401) {
        // refresh once
        const refreshed = await this.refreshTokensAndPersist(refreshToken);
        currentAccessToken = refreshed.access_token;
        refreshToken = refreshed.refresh_token || refreshToken;
        continue; // retry loop with same nextUrl
      }

      if (!res.ok) {
        // Don't include response body in error message
        throw new Error(`API request failed: ${res.status}`);
      }

      const data = (await parseScJson(res, { context: endpoint })) || {};
      if (Array.isArray(data.collection)) {
        allItems.push(...data.collection);
      }
      nextUrl = data.next_href || null;
    }

    return allItems;
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(accessToken, refreshToken, title, description, trackIds = []) {
    const payload = {
      playlist: {
        title,
        description: description || '',
        sharing: 'public',
        ...(trackIds.length > 0 ? { tracks: trackIds.map(id => ({ urn: `soundcloud:tracks:${id}` })) } : {})
      }
    };

    return this.scRequest('/playlists', accessToken, refreshToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Add tracks to a playlist
   */
  async addTracksToPlaylist(accessToken, refreshToken, playlistId, trackIds) {
    const payload = {
      playlist: {
        tracks: trackIds.map(id => ({ urn: `soundcloud:tracks:${id}` }))
      }
    };

    return this.scRequest(`/playlists/${playlistId}`, accessToken, refreshToken, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Resolve a SoundCloud URL to get track/playlist information
   */
  async resolveUrl(accessToken, refreshToken, url) {
    const params = new URLSearchParams({
      url,
      client_id: this.clientId
    });

    return this.scRequest(`/resolve?${params.toString()}`, accessToken, refreshToken);
  }

  /**
   * Resolve URL with explicit 302 handling
   */
  async resolveAny(accessToken, refreshToken, targetUrl) {
    const doFetch = async (token) => {
      const res = await fetch(`https://api.soundcloud.com/resolve?url=${encodeURIComponent(targetUrl)}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'Authorization': `OAuth ${token}`,
          'Accept': 'application/json'
        }
      });
      if (res.status === 302) {
        const location = res.headers.get('location');
        if (!location) throw new Error('Resolve redirect missing location');
        const res2 = await fetch(location, {
          headers: {
            'Authorization': `OAuth ${token}`,
            'Accept': 'application/json'
          }
        });
        if (!res2.ok) {
          // Don't include response body in error message
          throw new Error(`Resolve follow error: ${res2.status}`);
        }
        return parseScJson(res2, { context: 'resolve' });
      }
      if (!res.ok) {
        // Don't include response body in error message
        throw new Error(`Resolve error: ${res.status}`);
      }
      return parseScJson(res, { context: 'resolve' });
    };

    try {
      return await doFetch(accessToken);
    } catch (err) {
      if (!String(err?.message || '').includes('401')) throw err;
      const refreshed = await this.refreshTokensAndPersist(refreshToken);
      return doFetch(refreshed.access_token);
    }
  }

  /**
   * Resolve URL using public client_id (no OAuth). Works for public resources.
   */
  async resolvePublic(targetUrl) {
    const base = `https://api.soundcloud.com/resolve?url=${encodeURIComponent(targetUrl)}&client_id=${encodeURIComponent(this.clientId)}`;
    const res = await fetch(base, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'Accept': 'application/json' }
    });
    if (res.status === 302) {
      const location = res.headers.get('location');
      if (!location) throw new Error('Resolve redirect missing location');
      const res2 = await fetch(location, { headers: { 'Accept': 'application/json' } });
      if (!res2.ok) {
        // Don't include response body in error message
        throw new Error(`Resolve follow error: ${res2.status}`);
      }
      return parseScJson(res2, { context: 'resolve (public)' });
    }
    if (!res.ok) {
      // Don't include response body in error message
      throw new Error(`Resolve error: ${res.status}`);
    }
    return parseScJson(res, { context: 'resolve (public)' });
  }

  buildPagedEndpoint(endpoint, { limit = 50, next, extraParams = {} } = {}) {
    if (next) {
      const nextUrl = new URL(String(next));
      return `${nextUrl.pathname}${nextUrl.search}`;
    }

    const params = new URLSearchParams({
      limit: String(limit),
      linked_partitioning: '1',
      ...extraParams,
    });
    return `${endpoint}?${params.toString()}`;
  }

  /**
   * Get a page of another user's public liked tracks.
   */
  async getUserLikedTracksPage(accessToken, refreshToken, userId, options = {}) {
    const endpoint = this.buildPagedEndpoint(`/users/${userId}/likes/tracks`, options);
    return this.scRequest(endpoint, accessToken, refreshToken);
  }

  /**
   * Get all public liked tracks visible for another user.
   */
  async getUserLikedTracks(accessToken, refreshToken, userId, limit = 200) {
    return this.paginate(`/users/${userId}/likes/tracks`, accessToken, refreshToken, limit);
  }

  /**
   * Get a page of another user's public playlists without embedded tracks.
   */
  async getUserPlaylistsPage(accessToken, refreshToken, userId, options = {}) {
    const endpoint = this.buildPagedEndpoint(`/users/${userId}/playlists`, {
      ...options,
      extraParams: { show_tracks: 'false', ...(options.extraParams || {}) },
    });
    return this.scRequest(endpoint, accessToken, refreshToken);
  }

  /**
   * Get a page of playlists liked by another user when visible via the API.
   */
  async getUserLikedPlaylistsPage(accessToken, refreshToken, userId, options = {}) {
    const endpoint = this.buildPagedEndpoint(`/users/${userId}/likes/playlists`, {
      ...options,
      extraParams: { show_tracks: 'false', ...(options.extraParams || {}) },
    });
    return this.scRequest(endpoint, accessToken, refreshToken);
  }

  /**
   * Get the user's activity/stream feed
   */
  async getActivities(accessToken, refreshToken, limit = 50) {
    return this.paginate('/me/activities', accessToken, refreshToken, limit);
  }

  /**
   * Unlike a track by its ID
   */
  async unlikeTrack(accessToken, refreshToken, trackId) {
    return this.scRequest(`/likes/tracks/${trackId}`, accessToken, refreshToken, { method: 'DELETE' });
  }

  /**
   * Get the user's followings list
   */
  async getFollowings(accessToken, refreshToken, limit = 50) {
    return this.paginate('/me/followings', accessToken, refreshToken, limit);
  }

  /**
   * Get the user's followers list
   */
  async getFollowers(accessToken, refreshToken, limit = 50) {
    return this.paginate('/me/followers', accessToken, refreshToken, limit);
  }

  /**
   * Unfollow a user by their ID
   */
  async unfollowUser(accessToken, refreshToken, userId) {
    return this.scRequest(`/me/followings/${userId}`, accessToken, refreshToken, { method: 'DELETE' });
  }

  /**
   * Get the user's reposts using SoundCloud's V2 API
   * (same endpoint SC's web app uses for the profile "Reposts" tab).
   * Falls back to the V1 activity feed if the V2 endpoint fails.
   */
  async getReposts(accessToken, refreshToken) {
    try {
      const [trackReposts, playlistReposts] = await Promise.all([
        this.paginate('/me/reposts/tracks', accessToken, refreshToken, 200),
        this.paginate('/me/reposts/playlists', accessToken, refreshToken, 200),
      ]);

      const normalize = (items, resourceType) => {
        return items.map(item => {
          // Some endpoints return { track: {...} }, others return the resource directly
          const resource = item.track || item.playlist || item;
          const id = resource.id ? Number(resource.id) : null;
          if (!id) return null;

          return {
            id,
            urn: resource.urn || `soundcloud:${resourceType}s:${id}`,
            resourceType,
            title: resource.title || 'Unknown',
            user: { username: resource.user?.username || 'Unknown' },
            artwork_url: resource.artwork_url || resource.user?.avatar_url || null,
            permalink_url: resource.permalink_url || null,
            created_at: item.created_at || resource.created_at || null,
          };
        }).filter(Boolean);
      };

      const results = [
        ...normalize(trackReposts, 'track'),
        ...normalize(playlistReposts, 'playlist')
      ];

      // Sort by created_at descending if available
      results.sort((a, b) => {
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      logger.info(`[getReposts] returning ${results.length} reposts`);
      return results;
    } catch (e) {
      logger.error('[getReposts] error fetching reposts:', e.message);
      return [];
    }
  }

  /**
   * Get the user's recently played tracks
   */
  async getRecentlyPlayed(accessToken, refreshToken) {
    const data = await this.scRequest('/me/recently-played/tracks', accessToken, refreshToken);
    return data?.collection || [];
  }

  /**
   * Get related artists for a user
   */
  async getRelatedArtists(userUrn, accessToken, refreshToken, limit = 10) {
    const data = await this.scRequest(`/users/${userUrn}/related?limit=${limit}&linked_partitioning=1`, accessToken, refreshToken);
    return data?.collection || [];
  }

  /**
   * Remove a repost. resourceType must be 'track' or 'playlist'.
   */
  async deleteRepost(accessToken, refreshToken, id, resourceType) {
    const path = resourceType === 'playlist'
      ? `/reposts/playlists/${id}`
      : `/reposts/tracks/${id}`;
    return this.scRequest(path, accessToken, refreshToken, { method: 'DELETE' });
  }

  /**
   * Delete a playlist by its ID
   */
  async deletePlaylist(accessToken, refreshToken, playlistId) {
    return this.scRequest(`/playlists/${playlistId}`, accessToken, refreshToken, { method: 'DELETE' });
  }

  /**
   * Search tracks by genre, tags, and other filters
   */
  async searchTracks(accessToken, refreshToken, params = {}) {
    const queryParams = new URLSearchParams();

    if (params.genres) queryParams.set('genres', params.genres);
    if (params.tags) queryParams.set('tags', params.tags);
    if (params.q) queryParams.set('q', params.q);
    if (params.bpm_from) queryParams.set('bpm[from]', String(params.bpm_from));
    if (params.bpm_to) queryParams.set('bpm[to]', String(params.bpm_to));
    if (params.duration_from) queryParams.set('duration[from]', String(params.duration_from));
    if (params.duration_to) queryParams.set('duration[to]', String(params.duration_to));
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.offset) queryParams.set('offset', String(params.offset));

    queryParams.set('linked_partitioning', '1');

    return this.scRequest(`/tracks?${queryParams.toString()}`, accessToken, refreshToken);
  }

  /**
   * Get the final download link for a track
   * Handles the redirect manually to ensure we get the final URL
   */
  async getDownloadLink(accessToken, refreshToken, downloadUrl, triedRefresh = false) {
    // Only allow SoundCloud API download URLs to prevent SSRF / token leakage
    try {
      const u = new URL(downloadUrl);
      const host = u.hostname.toLowerCase();
      if (u.protocol !== 'https:' || host !== 'api.soundcloud.com') {
        throw new Error('Invalid download URL');
      }
      if (!/^\/tracks\/\d+\/download$/.test(u.pathname)) {
        throw new Error('Invalid download path');
      }
    } catch (e) {
      if (e.message === 'Invalid download URL' || e.message === 'Invalid download path') throw e;
      throw new Error('Invalid download URL');
    }

    const fetchUrl = downloadUrl.replace('https://api.soundcloud.com', this.baseUrl);
    const res = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `OAuth ${accessToken}`,
        'Accept': 'application/json, */*'
      },
      redirect: 'manual' 
    });

    if (res.status === 302 || res.status === 301) {
      return { redirect: res.headers.get('location') };
    }
    
    if (res.status === 200) {
        // Sometimes it returns the file directly? Or a JSON with the link?
        // Usually it's a redirect. If it's 200, it might be the binary data, 
        // which we can't easily proxy without streaming.
        // But for "download" we usually want to redirect the user.
        // Let's check headers.
        const type = res.headers.get('content-type');
        if (type && type.includes('application/json')) {
            const json = (await parseScJson(res, { context: 'download' })) || {};
            return { redirect: json.redirectUri || json.url || json.link }; // Handle various JSON responses
        }
        // If it's a file, we might be in trouble if we expected a link.
        // But the 401 error usually implies we failed the manifest check.
        // Let's assume correct auth gets us a redirect.
    }

    if (res.status === 401 && !triedRefresh) {
        // Try refreshing
        const refreshed = await this.refreshTokensAndPersist(refreshToken);
        return this.getDownloadLink(refreshed.access_token, refreshed.refresh_token || refreshToken, downloadUrl, true);
    }
    
    throw new Error(`Download request failed: ${res.status}`);
  }
}

export const soundcloudClient = new SoundCloudClient();