import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
import { encrypt, decrypt } from './crypto.js';
import logger from './logger.js';

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

    return response.json();
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

    return response.json();
  }

  /**
   * Make authenticated request to SoundCloud API with automatic token refresh
   */
  async scRequest(endpoint, accessToken, refreshToken, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `OAuth ${accessToken}`,
        'Accept': 'application/json',
        ...options.headers
      }
    });

    // Handle 401 - token expired, try to refresh
    if (response.status === 401) {
      try {
        const newTokens = await this.refreshTokens(refreshToken);
        const newAccessToken = newTokens.access_token;
        const newRefreshToken = newTokens.refresh_token;

        // Retry the request with new token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `OAuth ${newAccessToken}`,
            'Accept': 'application/json',
            ...options.headers
          }
        });

        if (!retryResponse.ok) {
          // Don't include response body in error message
          throw new Error(`API request failed after token refresh: ${retryResponse.status}`);
        }

        return retryResponse.json();
      } catch (refreshError) {
        // Don't expose refresh error details
        throw new Error(`Token refresh failed`);
      }
    }

    // Handle 429 - rate limit, implement exponential backoff
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.scRequest(endpoint, accessToken, refreshToken, options);
    }

    if (!response.ok) {
      // Don't include response body in error message to prevent secret leakage
      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
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
        const refreshed = await this.refreshTokens(refreshToken);
        currentAccessToken = refreshed.access_token;
        continue; // retry loop with same nextUrl
      }

      if (!res.ok) {
        // Don't include response body in error message
        throw new Error(`API request failed: ${res.status}`);
      }

      const data = await res.json();
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
        return res2.json();
      }
      if (!res.ok) {
        // Don't include response body in error message
        throw new Error(`Resolve error: ${res.status}`);
      }
      return res.json();
    };

    try {
      return await doFetch(accessToken);
    } catch (err) {
      // try refresh once on 401 path via scRequest-style refresh
      const refreshed = await this.refreshTokens(refreshToken);
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
      return res2.json();
    }
    if (!res.ok) {
      // Don't include response body in error message
      throw new Error(`Resolve error: ${res.status}`);
    }
    return res.json();
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
   * Get the final download link for a track
   * Handles the redirect manually to ensure we get the final URL
   */
  async getDownloadLink(accessToken, refreshToken, downloadUrl) {
    // Append client_id if needed, but usually download_url has it or needs auth token
    // We'll try with auth token primarily
    
    // We need to fetch with redirect: manual to capture the location header if it redirects
    // or just let it follow triggers if the final link doesn't need auth. 
    // SoundCloud API usually returns a 302 to the actual file (e.g. CF/S3)
    
    // NOTE: The download_url from the track object often looks like: 
    // https://api.soundcloud.com/tracks/123/download
    
    // We use scRequest which adds the base URL, but download_url is absolute.
    // So we use fetch directly or a modified helper.
    // Let's use a direct fetch with our token.

    const urlWithToken = new URL(downloadUrl);
    // Some download URLs are already signed or just need OAuth
    // If we provide the OAuth token in header, it should work.

    const res = await fetch(downloadUrl.replace('https://api.soundcloud.com', this.baseUrl), {
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
            const json = await res.json();
            return { redirect: json.redirectUri || json.url || json.link }; // Handle various JSON responses
        }
        // If it's a file, we might be in trouble if we expected a link.
        // But the 401 error usually implies we failed the manifest check.
        // Let's assume correct auth gets us a redirect.
    }

    if (res.status === 401) {
        // Try refreshing
        const refreshed = await this.refreshTokens(refreshToken);
        return this.getDownloadLink(refreshed.access_token, refreshToken, downloadUrl);
    }
    
    throw new Error(`Download request failed: ${res.status}`);
  }
}

export const soundcloudClient = new SoundCloudClient();