import { soundcloudClient } from './soundcloud-client.js';

/**
 * Sanitize and validate a SoundCloud URL. Returns the canonical URL string
 * with tracking params removed, or '' if the input isn't a SoundCloud URL.
 * (Pure — mirrors `sanitizeUrl` in routes/api.js so the chat tool can call it
 * without dragging request/response state along.)
 */
export function sanitizeSoundcloudUrl(input = '') {
  let url = String(input).trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!/(^|\.)soundcloud\.com$/.test(host) && host !== 'on.soundcloud.com') return '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'si'].forEach((k) =>
      u.searchParams.delete(k),
    );
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
    const m = maybe.match(/(tracks|playlists|users):(\d+)/);
    if (m) return Number(m[2]);
  }
  return undefined;
}

/** Normalize a SoundCloud resolve resource into a compact, model-friendly object. */
export function normalizeResolveResult(resource) {
  if (!resource) return null;
  const kind = resource.kind;
  if (kind === 'track') {
    return {
      type: 'track',
      id: extractNumericId(resource.id || resource.urn),
      title: resource.title,
      username: resource.user?.username,
      duration_ms: resource.duration,
      genre: resource.genre || null,
      permalink_url: resource.permalink_url,
      artwork_url: resource.artwork_url || resource.user?.avatar_url,
    };
  }
  if (kind === 'playlist') {
    return {
      type: 'playlist',
      id: extractNumericId(resource.id || resource.urn),
      title: resource.title,
      username: resource.user?.username,
      track_count: resource.track_count,
      permalink_url: resource.permalink_url,
    };
  }
  if (kind === 'user') {
    return {
      type: 'user',
      id: extractNumericId(resource.id || resource.urn),
      username: resource.username,
      followers_count: resource.followers_count,
      permalink_url: resource.permalink_url,
    };
  }
  if (resource.track) return normalizeResolveResult({ ...resource.track, kind: 'track' });
  if (resource.playlist) return normalizeResolveResult({ ...resource.playlist, kind: 'playlist' });
  if (resource.username) return normalizeResolveResult({ ...resource, kind: 'user' });
  return null;
}

/**
 * Resolve a SoundCloud URL to compact metadata.
 * Tries the authenticated resolve first; falls back to the public resolver on
 * auth failures. Returns null on unrecognized resources, throws on hard errors.
 */
export async function resolveSoundcloudUrl(url, accessToken, refreshToken, { sc = soundcloudClient } = {}) {
  const cleaned = sanitizeSoundcloudUrl(url);
  if (!cleaned) throw new Error('Invalid SoundCloud URL');

  let resource;
  try {
    resource = await sc.resolveAny(accessToken, refreshToken, cleaned);
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('invalid_grant') || msg.includes('401')) {
      resource = await sc.resolvePublic(cleaned);
    } else {
      throw e;
    }
  }
  return normalizeResolveResult(resource);
}
