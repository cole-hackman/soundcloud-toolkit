import { CHAT_TOOL_DEFINITIONS, dispatchTool } from '../server/lib/chat-tools.js';

describe('CHAT_TOOL_DEFINITIONS', () => {
  test('every tool has an OpenAI function schema', () => {
    for (const t of CHAT_TOOL_DEFINITIONS) {
      expect(t.type).toBe('function');
      expect(typeof t.function.name).toBe('string');
      expect(t.function.parameters.type).toBe('object');
    }
  });
});

describe('dispatchTool', () => {
  const ctx = {
    userId: 'u1',
    index: {
      countLikesByArtist: async () => ({ count: 7, sample: [{ trackId: 1, title: 'X' }] }),
      countLikesByGenre: async () => ({ count: 3, sample: [] }),
      searchLikes: async () => [{ trackId: 1, title: 'X' }],
      findTopOverlappingPlaylists: async () => [{ playlistA: { id: 1 }, playlistB: { id: 2 }, sharedTracks: 3 }],
    },
  };

  test('routes count_likes (artist) to the index', async () => {
    const out = await dispatchTool('count_likes', { artist: 'Riordan' }, ctx);
    expect(out.count).toBe(7);
  });

  test('returns an error object for an unknown tool', async () => {
    const out = await dispatchTool('does_not_exist', {}, ctx);
    expect(out.error).toMatch(/unknown tool/i);
  });
});
