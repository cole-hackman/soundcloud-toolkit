import { jest } from '@jest/globals';

const getPlaylistWithTracks = jest.fn();
const loadCachedPlaylists = jest.fn();

jest.unstable_mockModule('../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { getPlaylistWithTracks },
}));
jest.unstable_mockModule('../server/lib/social-cache.js', () => ({
  loadCachedPlaylists,
}));

const { pagePlaylistsWithTracks } = await import('../server/lib/playlist-pages.js');

const req = { user: { id: 'u1' }, accessToken: 'at', refreshToken: 'rt' };
const stubs = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `P${i + 1}` }));
const cached = (items, extra = {}) => ({ collection: items, total: items.length, ...extra });

beforeEach(() => {
  getPlaylistWithTracks.mockReset();
  loadCachedPlaylists.mockReset();
  getPlaylistWithTracks.mockImplementation(async (a, r, id) => ({ id, title: `P${id}`, tracks: [] }));
});

describe('pagePlaylistsWithTracks slice math', () => {
  test('a full page in the middle of the library knows there is more behind it', async () => {
    loadCachedPlaylists.mockResolvedValue(cached(stubs(61)));

    const { page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 40 });

    expect(page).toMatchObject({
      limit: 20, offset: 40, returned: 20, total: 61, hasMore: true, from: 41, to: 60,
    });
  });

  test('a final short page reports its real end and no more to come', async () => {
    loadCachedPlaylists.mockResolvedValue(cached(stubs(45)));

    const { page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 40 });

    expect(page).toMatchObject({
      returned: 5, total: 45, hasMore: false, from: 41, to: 45,
    });
  });

  test('an offset past the end is an empty page, not a phantom range', async () => {
    // The bug this replaces: SoundCloud ignores offset on /me/playlists, so a
    // walk past the end kept returning page one under a "playlists 81-100"
    // label. An out-of-range slice must read as empty.
    loadCachedPlaylists.mockResolvedValue(cached(stubs(10)));

    const { playlists, page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 80 });

    expect(playlists).toEqual([]);
    expect(getPlaylistWithTracks).not.toHaveBeenCalled();
    expect(page).toMatchObject({ from: 0, to: 80, returned: 0, hasMore: false, total: 10 });
  });

  test('an empty library is an empty page', async () => {
    loadCachedPlaylists.mockResolvedValue(cached([]));

    const { page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 0 });

    expect(page).toMatchObject({ from: 0, to: 0, returned: 0, total: 0, hasMore: false });
  });

  test('carries the cache tier flags through so the UI can caveat the list', async () => {
    loadCachedPlaylists.mockResolvedValue(cached(stubs(3), { stale: true, truncated: true }));

    const { page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 0 });

    expect(page.stale).toBe(true);
    expect(page.truncated).toBe(true);
  });

  test('a fresh complete list reports neither flag', async () => {
    loadCachedPlaylists.mockResolvedValue(cached(stubs(3)));

    const { page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 0 });

    expect(page.stale).toBe(false);
    expect(page.truncated).toBe(false);
  });
});

describe('pagePlaylistsWithTracks failure handling', () => {
  test('an unreadable playlist is collected, not dropped', async () => {
    loadCachedPlaylists.mockResolvedValue(cached(stubs(3)));
    getPlaylistWithTracks.mockImplementation(async (a, r, id) => {
      if (id === 2) throw new Error('boom');
      return { id, title: `P${id}`, tracks: [] };
    });

    const { playlists, failed, page } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 0 });

    expect(playlists).toHaveLength(2);
    expect(failed).toEqual([{ id: 2, title: 'P2' }]);
    // `returned` counts what was actually read, so it and `to` disagree
    // exactly by the number of failures.
    expect(page).toMatchObject({ returned: 2, from: 1, to: 3 });
  });

  test('every playlist failing yields an empty page rather than a throw', async () => {
    loadCachedPlaylists.mockResolvedValue(cached(stubs(3)));
    getPlaylistWithTracks.mockRejectedValue(new Error('nope'));

    const { playlists, failed } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 0 });

    expect(playlists).toEqual([]);
    expect(failed).toHaveLength(3);
  });

  test('a stub with no title still names the playlist by id', async () => {
    loadCachedPlaylists.mockResolvedValue(cached([{ id: 9 }]));
    getPlaylistWithTracks.mockRejectedValue(new Error('nope'));

    const { failed } = await pagePlaylistsWithTracks(req, { limit: 20, offset: 0 });

    expect(failed).toEqual([{ id: 9, title: null }]);
  });
});
