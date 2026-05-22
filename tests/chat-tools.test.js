import { CHAT_TOOL_DEFINITIONS, dispatchTool } from '../server/lib/chat-tools.js';

describe('CHAT_TOOL_DEFINITIONS', () => {
  test('every tool has an OpenAI function schema', () => {
    for (const t of CHAT_TOOL_DEFINITIONS) {
      expect(t.type).toBe('function');
      expect(typeof t.function.name).toBe('string');
      expect(t.function.parameters.type).toBe('object');
    }
  });
  test('exposes the full v1.5 tool set', () => {
    const names = CHAT_TOOL_DEFINITIONS.map((t) => t.function.name).sort();
    expect(names).toEqual([
      'compare_playlists',
      'count_likes',
      'find_top_overlapping_playlists',
      'get_me_stats',
      'library_audit_summary',
      'list_playlists',
      'resolve_url',
      'search_likes',
    ]);
  });
});

const fakeIndex = {
  countLikesByArtist: async () => ({ count: 7, sample: [{ trackId: 1, title: 'X' }] }),
  countLikesByGenre: async () => ({ count: 3, sample: [] }),
  searchLikes: async () => [{ trackId: 1, title: 'X' }],
  findTopOverlappingPlaylists: async () => [
    { playlistA: { id: 1 }, playlistB: { id: 2 }, sharedTracks: 3 },
  ],
  listPlaylistsFromIndex: async () => [{ id: 10, title: 'From Index', trackCount: 4 }],
};

const fakeSc = {
  getMe: async () => ({
    username: 'me',
    full_name: 'Me Person',
    followers_count: 12,
    followings_count: 9,
    likes_count: 100,
    playlist_count: 4,
    track_count: 0,
  }),
  getPlaylistWithTracks: async (_t, _r, id) => ({
    id,
    title: id === 1 ? 'A' : 'B',
    tracks: id === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 2 }, { id: 3 }],
  }),
  getPlaylists: async () => ({
    collection: [{ id: 11, title: 'P', track_count: 3, tracks: [] }],
  }),
  resolveAny: async () => ({ kind: 'track', id: 99, title: 'Resolved', user: { id: 1, username: 'a' } }),
  resolvePublic: async () => null,
};

const baseCtx = { userId: 'u1', accessToken: 'a', refreshToken: 'r', index: fakeIndex, sc: fakeSc };

describe('dispatchTool', () => {
  test('routes count_likes (artist) to the index', async () => {
    const out = await dispatchTool('count_likes', { artist: 'Riordan' }, baseCtx);
    expect(out.count).toBe(7);
  });

  test('returns an error object for an unknown tool', async () => {
    const out = await dispatchTool('does_not_exist', {}, baseCtx);
    expect(out.error).toMatch(/unknown tool/i);
  });

  test('get_me_stats returns SC profile counts', async () => {
    const out = await dispatchTool('get_me_stats', {}, baseCtx);
    expect(out).toMatchObject({ username: 'me', followers_count: 12, playlist_count: 4 });
  });

  test('compare_playlists returns a summary with shared tracks', async () => {
    const out = await dispatchTool('compare_playlists', { playlistAId: 1, playlistBId: 2 }, baseCtx);
    expect(out.summary.overlapCount).toBe(1);
    expect(out.summary.playlistA.trackCount).toBe(2);
  });

  test('compare_playlists rejects same-id pairs', async () => {
    const out = await dispatchTool('compare_playlists', { playlistAId: 1, playlistBId: 1 }, baseCtx);
    expect(out.error).toMatch(/distinct/);
  });

  test('library_audit_summary returns a summary object', async () => {
    const out = await dispatchTool('library_audit_summary', {}, baseCtx);
    expect(typeof out).toBe('object');
    expect(out).not.toHaveProperty('error');
  });

  test('resolve_url returns normalized data', async () => {
    const out = await dispatchTool('resolve_url', { url: 'https://soundcloud.com/x/t' }, baseCtx);
    expect(out.type).toBe('track');
    expect(out.id).toBe(99);
  });

  test('resolve_url rejects empty url', async () => {
    const out = await dispatchTool('resolve_url', { url: '' }, baseCtx);
    expect(out.error).toMatch(/url is required/);
  });

  test('list_playlists reads from the index when populated', async () => {
    const out = await dispatchTool('list_playlists', {}, baseCtx);
    expect(out.source).toBe('index');
    expect(out.playlists[0]).toMatchObject({ id: 10, title: 'From Index' });
  });

  test('list_playlists falls back to live SC when the index is empty', async () => {
    const ctx = { ...baseCtx, index: { ...fakeIndex, listPlaylistsFromIndex: async () => [] } };
    const out = await dispatchTool('list_playlists', {}, ctx);
    expect(out.source).toBe('live');
    expect(out.playlists[0]).toMatchObject({ id: 11, title: 'P', trackCount: 3 });
  });
});
