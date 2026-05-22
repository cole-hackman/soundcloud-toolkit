import * as defaultIndex from './library-index.js';
import { soundcloudClient as defaultSc } from './soundcloud-client.js';
import { comparePlaylists } from './playlist-compare.js';
import { summarizeLibraryAudit } from './library-audit.js';
import { resolveSoundcloudUrl } from './resolve-soundcloud-url.js';
import { buildDeepLink } from './chat-deep-links.js';

const LIBRARY_AUDIT_PLAYLIST_CAP = 20;

/** OpenAI tool/function schemas exposed to the model (all read-only). */
export const CHAT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'count_likes',
      description: "Count the user's liked tracks filtered by artist OR genre. Provide exactly one.",
      parameters: {
        type: 'object',
        properties: {
          artist: { type: 'string', description: 'Artist/username substring to match' },
          genre: { type: 'string', description: 'Genre name, e.g. "Tech House"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_likes',
      description: "List the user's liked tracks matching artist, genre, and/or a free-text query.",
      parameters: {
        type: 'object',
        properties: {
          artist: { type: 'string' },
          genre: { type: 'string' },
          q: { type: 'string', description: 'Free-text match against track title' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_top_overlapping_playlists',
      description: "Find which of the user's playlists share the most tracks.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_me_stats',
      description: "Get the user's SoundCloud profile stats (follower/following/like/playlist/track counts).",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_playlists',
      description: 'Compare two of the user\'s playlists by track-id overlap. Returns counts and Jaccard %.',
      parameters: {
        type: 'object',
        required: ['playlistAId', 'playlistBId'],
        properties: {
          playlistAId: { type: 'integer' },
          playlistBId: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'library_audit_summary',
      description: "Summarize the health of the user's library: blocked/non-streamable counts, duplicates, sizes.",
      parameters: {
        type: 'object',
        properties: { playlistLimit: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'resolve_url',
      description: 'Resolve a SoundCloud URL to compact metadata about the track, playlist, or user.',
      parameters: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_create_playlist_from_tracks',
      description:
        'Propose creating a new playlist from a list of track ids. Returns a confirmation card; the user must explicitly confirm before anything happens. Use this whenever the user asks to make/create/save a playlist.',
      parameters: {
        type: 'object',
        required: ['trackIds', 'title'],
        properties: {
          trackIds: { type: 'array', items: { type: 'integer' }, minItems: 1 },
          title: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_bulk_unlike',
      description:
        'Propose unliking a batch of tracks (max 100). Returns a confirmation card; the user must explicitly confirm before anything happens.',
      parameters: {
        type: 'object',
        required: ['trackIds'],
        properties: {
          trackIds: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 100 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_playlists',
      description: "List the user's playlists with id, title, and track count. Reads from the library index when available.",
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
      },
    },
  },
];

/**
 * Execute a tool by name. Returns a plain JSON-serializable result the model can read.
 * Never throws — errors are returned as { error } so the loop can continue.
 * ctx: { userId, accessToken?, refreshToken?, index?, sc?, prisma? }
 */
export async function dispatchTool(name, args = {}, ctx = {}) {
  const index = ctx.index || defaultIndex;
  const sc = ctx.sc || defaultSc;
  const { userId, accessToken, refreshToken } = ctx;
  try {
    switch (name) {
      case 'count_likes': {
        if (args.artist) return await index.countLikesByArtist(userId, args.artist);
        if (args.genre) return await index.countLikesByGenre(userId, args.genre);
        return { error: 'Provide either artist or genre.' };
      }
      case 'search_likes': {
        const rows = await index.searchLikes(userId, {
          artist: args.artist,
          genre: args.genre,
          q: args.q,
          limit: args.limit ?? 20,
        });
        const tracks = rows.slice(0, args.limit ?? 20);
        return {
          count: rows.length,
          tracks,
          display: {
            kind: 'tracks',
            tracks: tracks.map((t) => ({
              id: t.trackId,
              title: t.title,
              artist: t.artistName,
              genre: t.genre,
            })),
            deepLink: buildDeepLink('like-manager-filter', {
              artist: args.artist,
              genre: args.genre,
              q: args.q,
            }),
          },
        };
      }
      case 'find_top_overlapping_playlists': {
        const pairs = await index.findTopOverlappingPlaylists(userId, { limit: args.limit ?? 5 });
        return {
          pairs,
          display: {
            kind: 'playlist_pairs',
            pairs: pairs.map((p) => ({
              ...p,
              deepLink: buildDeepLink('playlist-compare', { a: p.playlistA.id, b: p.playlistB.id }),
            })),
          },
        };
      }
      case 'get_me_stats': {
        const me = await sc.getMe(accessToken, refreshToken);
        return {
          username: me.username,
          displayName: me.full_name || me.username,
          followers_count: me.followers_count ?? null,
          followings_count: me.followings_count ?? null,
          likes_count: me.likes_count ?? me.public_favorites_count ?? null,
          playlist_count: me.playlist_count ?? null,
          track_count: me.track_count ?? null,
        };
      }
      case 'compare_playlists': {
        const a = Number(args.playlistAId);
        const b = Number(args.playlistBId);
        if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) {
          return { error: 'Provide two distinct integer playlist ids' };
        }
        const [playlistA, playlistB] = await Promise.all([
          sc.getPlaylistWithTracks(accessToken, refreshToken, a),
          sc.getPlaylistWithTracks(accessToken, refreshToken, b),
        ]);
        const result = comparePlaylists(playlistA, playlistB);
        return {
          summary: result.summary,
          display: {
            kind: 'playlist_pair',
            summary: result.summary,
            deepLink: buildDeepLink('playlist-compare', { a, b }),
          },
        };
      }
      case 'library_audit_summary': {
        const cap = Math.min(Math.max(args.playlistLimit || 20, 1), LIBRARY_AUDIT_PLAYLIST_CAP);
        const page = await sc.getPlaylists(accessToken, refreshToken, cap, 0);
        const playlists = Array.isArray(page?.collection)
          ? page.collection
          : Array.isArray(page)
            ? page
            : [];
        const fullPlaylists = [];
        for (const p of playlists) {
          try {
            const full = await sc.getPlaylistWithTracks(accessToken, refreshToken, p.id);
            fullPlaylists.push(full);
          } catch {
            /* skip failed fetches */
          }
        }
        const audit = summarizeLibraryAudit(fullPlaylists);
        return audit.summary || audit;
      }
      case 'resolve_url': {
        if (typeof args.url !== 'string' || !args.url.trim()) {
          return { error: 'url is required' };
        }
        const data = await resolveSoundcloudUrl(args.url, accessToken, refreshToken, { sc });
        if (!data) return { error: 'Unsupported or unknown SoundCloud resource' };
        return data;
      }
      case 'list_playlists': {
        return await listUserPlaylists(userId, { limit: args.limit ?? 50 }, { index, sc, accessToken, refreshToken });
      }
      case 'propose_create_playlist_from_tracks': {
        const trackIds = Array.isArray(args.trackIds) ? args.trackIds.filter(Number.isInteger) : [];
        const title = (typeof args.title === 'string' ? args.title.trim() : '') || `Library Chat ${new Date().toISOString().slice(0, 10)}`;
        if (!trackIds.length) return { error: 'trackIds must contain at least one integer' };
        return {
          display: {
            kind: 'proposal',
            action: 'create_playlist',
            endpoint: '/api/playlists/from-likes',
            method: 'POST',
            payload: { trackIds, title },
            summary: `Create playlist "${title}" with ${trackIds.length} track${trackIds.length === 1 ? '' : 's'}?`,
          },
        };
      }
      case 'propose_bulk_unlike': {
        const trackIds = Array.isArray(args.trackIds) ? args.trackIds.filter(Number.isInteger) : [];
        if (!trackIds.length) return { error: 'trackIds must contain at least one integer' };
        if (trackIds.length > 100) return { error: 'bulk_unlike accepts at most 100 tracks per call' };
        return {
          display: {
            kind: 'proposal',
            action: 'bulk_unlike',
            endpoint: '/api/likes/tracks/bulk-unlike',
            method: 'POST',
            payload: { trackIds },
            summary: `Unlike ${trackIds.length} track${trackIds.length === 1 ? '' : 's'}?`,
          },
        };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: String(error?.message || 'tool execution failed') };
  }
}

/**
 * Reads playlists from the index when available; falls back to a live SC fetch
 * if the index has no rows yet. Internal helper, exported for direct testing.
 */
export async function listUserPlaylists(userId, { limit = 50 } = {}, { index = defaultIndex, sc = defaultSc, accessToken, refreshToken } = {}) {
  const fromIndex = await index.listPlaylistsFromIndex(userId, { limit });
  if (fromIndex && fromIndex.length) {
    return {
      source: 'index',
      playlists: fromIndex,
      display: { kind: 'playlists', items: fromIndex },
    };
  }

  const page = await sc.getPlaylists(accessToken, refreshToken, limit, 0);
  const list = Array.isArray(page?.collection)
    ? page.collection
    : Array.isArray(page)
      ? page
      : [];
  const playlists = list.slice(0, limit).map((p) => ({
    id: p.id,
    title: p.title,
    trackCount: p.track_count ?? (Array.isArray(p.tracks) ? p.tracks.length : null),
  }));
  return { source: 'live', playlists, display: { kind: 'playlists', items: playlists } };
}
