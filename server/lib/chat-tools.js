import * as defaultIndex from './library-index.js';

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
];

/**
 * Execute a tool by name. Returns a plain JSON-serializable result the model can read.
 * Never throws — errors are returned as { error } so the loop can continue.
 * ctx: { userId, index? } — index defaults to library-index module.
 */
export async function dispatchTool(name, args = {}, ctx = {}) {
  const index = ctx.index || defaultIndex;
  const userId = ctx.userId;
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
        return { count: rows.length, tracks: rows.slice(0, args.limit ?? 20) };
      }
      case 'find_top_overlapping_playlists': {
        const pairs = await index.findTopOverlappingPlaylists(userId, { limit: args.limit ?? 5 });
        return { pairs };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: String(error?.message || 'tool execution failed') };
  }
}
