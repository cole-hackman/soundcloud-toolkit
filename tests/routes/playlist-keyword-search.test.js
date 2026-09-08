import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';

const getPlaylists = jest.fn();
// The paged tools slice the cached full playlist list (getAllPlaylists, cursor
// paginated) rather than asking for a SoundCloud offset page. getPlaylists is
// kept in the mock so the tests can assert it is NOT called any more.
const getAllPlaylists = jest.fn();
const getPlaylistWithTracks = jest.fn();
const addTracksToPlaylist = jest.fn();
const logOperation = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { getPlaylists, getAllPlaylists, getPlaylistWithTracks, addTracksToPlaylist },
  // routes/api.js imports this alongside soundcloudClient for the oEmbed
  // supplement; the mock must provide it or the module fails to link.
  fetchWithTimeout: jest.fn(async () => ({ ok: false, status: 503 })),
}));
jest.unstable_mockModule('../../server/lib/snapshot-cache.js', () => ({
  readSnapshot: jest.fn().mockResolvedValue(null),
  writeSnapshot: jest.fn().mockResolvedValue({ pages: 1, items: 1 }),
  invalidateSnapshot: jest.fn().mockResolvedValue({ count: 0 }),
  dropSnapshots: jest.fn(),
  SNAPSHOT_RESOURCES: ['likes', 'playlists', 'followings', 'followers', 'reposts'],
}));
jest.unstable_mockModule('../../server/lib/analytics.js', () => ({
  logOperation,
  startOperationTimer: () => () => 42,
  extractClientInfo: () => ({}),
  getAnalyticsWriteHealth: () => ({ status: 'ok' }),
  instrumentRead: () => (req, res, next) => next(),
}));
jest.unstable_mockModule('../../server/lib/enrichment.js', () => ({
  piggybackEnrichment: jest.fn(),
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 'user-a', soundcloudId: 111 };
    req.accessToken = 'at';
    req.refreshToken = 'rt';
    next();
  },
}));

const { default: apiRoutes } = await import('../../server/routes/api.js');
// Real, not mocked: the playlist list is cached per user across the whole
// module lifetime, so without an explicit reset the second test in this file
// would be served the first test's playlists.
const { requestCache } = await import('../../server/lib/request-cache.js');
const { __resetCacheCoordinationForTests } = await import('../../server/lib/social-cache.js');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

afterAll(() => { process.env.NODE_ENV = ORIGINAL_NODE_ENV; });

beforeEach(() => {
  getPlaylists.mockReset();
  getAllPlaylists.mockReset();
  getPlaylistWithTracks.mockReset();
  addTracksToPlaylist.mockReset();
  logOperation.mockReset();
  requestCache.invalidateUser('user-a');
  __resetCacheCoordinationForTests();
});

/** N playlist stubs, ids 1..N — what getAllPlaylists hands back. */
const stubs = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `P${i + 1}` }));

const playlist = (id, title, tracks) => ({ id, title, tracks });
const track = (id, title, artist = 'Someone') => ({ id, title, user: { username: artist } });

describe('GET /api/playlists/search-tracks', () => {
  test('finds matches across a page of playlists', async () => {
    getAllPlaylists.mockResolvedValue(stubs(2));
    getPlaylistWithTracks
      .mockResolvedValueOnce(playlist(1, 'Warmup', [track(10, 'Deep Bootleg'), track(11, 'Nope')]))
      .mockResolvedValueOnce(playlist(2, 'Peak', [track(12, 'Another Bootleg')]));

    const res = await request(app).get('/api/playlists/search-tracks?q=bootleg&limit=2');

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(2);
    expect(res.body.stats.tracksScanned).toBe(3);
    expect(res.body.page).toMatchObject({ offset: 0, from: 1, to: 2 });
  });

  test('honours offset so a big library can be walked page by page', async () => {
    // 61 playlists, so the 41st through 60th are a full page with more behind
    // them. The offset is applied to the cached list here, not sent to
    // SoundCloud, whose /me/playlists ignores it.
    getAllPlaylists.mockResolvedValue(stubs(61));
    getPlaylistWithTracks.mockResolvedValue(playlist(5, 'Later', [track(50, 'Bootleg')]));

    const res = await request(app).get('/api/playlists/search-tracks?q=bootleg&limit=20&offset=40');

    expect(res.status).toBe(200);
    expect(getAllPlaylists).toHaveBeenCalledTimes(1);
    expect(getPlaylists).not.toHaveBeenCalled();
    expect(res.body.page).toMatchObject({ offset: 40, from: 41, to: 60, total: 61, hasMore: true });
  });

  test('searches a single playlist without listing the library', async () => {
    getPlaylistWithTracks.mockResolvedValue(playlist(7, 'One', [track(70, 'Bootleg Mix')]));

    const res = await request(app).get('/api/playlists/search-tracks?q=bootleg&playlistId=7');

    expect(res.status).toBe(200);
    expect(getPlaylists).not.toHaveBeenCalled();
    expect(getAllPlaylists).not.toHaveBeenCalled();
    expect(res.body.page).toBeNull();
    expect(res.body.matches[0].playlistId).toBe(7);
  });

  test('one unreadable playlist does not sink the search', async () => {
    getAllPlaylists.mockResolvedValue(stubs(2));
    getPlaylistWithTracks
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(playlist(2, 'Peak', [track(12, 'Bootleg')]));

    const res = await request(app).get('/api/playlists/search-tracks?q=bootleg');

    expect(res.status).toBe(200);
    expect(res.body.matches).toHaveLength(1);
    // Named, not silently dropped — otherwise a partial search reads as a
    // complete one that found less.
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.stats.playlistsFailed).toBe(1);
  });

  test('every playlist failing is still a 200, with the failures named', async () => {
    getAllPlaylists.mockResolvedValue(stubs(3));
    getPlaylistWithTracks.mockRejectedValue(new Error('nope'));

    const res = await request(app).get('/api/playlists/search-tracks?q=bootleg');

    expect(res.status).toBe(200);
    expect(res.body.matches).toEqual([]);
    expect(res.body.failed).toHaveLength(3);
    expect(res.body.stats.playlistsFailed).toBe(3);
  });

  test('an empty playlistId means "not scoped", not a playlist with id ""', async () => {
    // validatePlaylistTrackSearch uses checkFalsy, so `?playlistId=` skips
    // validation and arrives as ''. It must not be read as a scope.
    getAllPlaylists.mockResolvedValue(stubs(1));
    getPlaylistWithTracks.mockResolvedValue(playlist(1, 'P', [track(10, 'Bootleg')]));

    const res = await request(app).get('/api/playlists/search-tracks?q=bootleg&playlistId=');

    expect(res.status).toBe(200);
    expect(getAllPlaylists).toHaveBeenCalled();
    expect(getPlaylistWithTracks).toHaveBeenCalledWith('at', 'rt', 1);
    expect(res.body.page).not.toBeNull();
  });

  test('rejects a too-short query before calling SoundCloud', async () => {
    const res = await request(app).get('/api/playlists/search-tracks?q=a');
    expect(res.status).toBe(400);
    expect(getAllPlaylists).not.toHaveBeenCalled();
  });
});

describe('POST /api/playlists/tracks/bulk-remove', () => {
  test('PUTs the surviving track list and reports what went', async () => {
    getPlaylistWithTracks.mockResolvedValue(
      playlist(1, 'Warmup', [track(10, 'a'), track(11, 'b'), track(12, 'c')])
    );
    addTracksToPlaylist.mockResolvedValue({});

    const res = await request(app)
      .post('/api/playlists/tracks/bulk-remove')
      .send({ items: [{ playlistId: 1, trackIds: [11] }] });

    expect(res.status).toBe(200);
    expect(addTracksToPlaylist).toHaveBeenCalledWith('at', 'rt', 1, [10, 12]);
    expect(res.body.removedTotal).toBe(1);
    expect(res.body.results[0]).toMatchObject({ status: 'success', removed: 1, remaining: 2 });
  });

  test('skips a playlist that no longer holds the track, without writing', async () => {
    getPlaylistWithTracks.mockResolvedValue(playlist(1, 'Warmup', [track(10, 'a')]));

    const res = await request(app)
      .post('/api/playlists/tracks/bulk-remove')
      .send({ items: [{ playlistId: 1, trackIds: [99] }] });

    expect(res.status).toBe(200);
    expect(addTracksToPlaylist).not.toHaveBeenCalled();
    expect(res.body.results[0].status).toBe('skipped');
  });

  test('one failing playlist is reported without aborting the rest', async () => {
    getPlaylistWithTracks
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(playlist(2, 'Peak', [track(20, 'a'), track(21, 'b')]));
    addTracksToPlaylist.mockResolvedValue({});

    const res = await request(app)
      .post('/api/playlists/tracks/bulk-remove')
      .send({ items: [{ playlistId: 1, trackIds: [10] }, { playlistId: 2, trackIds: [21] }] });

    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.status)).toEqual(['error', 'success']);
    expect(res.body.removedTotal).toBe(1);
  });

  test('rejects the same playlist listed twice', async () => {
    const res = await request(app)
      .post('/api/playlists/tracks/bulk-remove')
      .send({ items: [{ playlistId: 1, trackIds: [1] }, { playlistId: 1, trackIds: [2] }] });
    expect(res.status).toBe(400);
    expect(getPlaylistWithTracks).not.toHaveBeenCalled();
  });

  test('rejects more than 200 track removals in one request', async () => {
    const many = Array.from({ length: 201 }, (_, i) => i + 1);
    const res = await request(app)
      .post('/api/playlists/tracks/bulk-remove')
      .send({ items: [{ playlistId: 1, trackIds: many }] });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/playlists/tracks/bulk-add', () => {
  test('appends new tracks and skips ones already there', async () => {
    getPlaylistWithTracks.mockResolvedValue(playlist(9, 'Target', [track(1, 'a')]));
    addTracksToPlaylist.mockResolvedValue({});

    const res = await request(app)
      .post('/api/playlists/tracks/bulk-add')
      .send({ targetPlaylistId: 9, trackIds: [1, 2] });

    expect(res.status).toBe(200);
    expect(addTracksToPlaylist).toHaveBeenCalledWith('at', 'rt', 9, [1, 2]);
    expect(res.body).toMatchObject({ added: 1, alreadyPresent: 1, noRoom: 0 });
  });

  test('writes nothing when every track is already present', async () => {
    getPlaylistWithTracks.mockResolvedValue(playlist(9, 'Target', [track(1, 'a')]));

    const res = await request(app)
      .post('/api/playlists/tracks/bulk-add')
      .send({ targetPlaylistId: 9, trackIds: [1] });

    expect(res.status).toBe(200);
    expect(addTracksToPlaylist).not.toHaveBeenCalled();
    expect(res.body.added).toBe(0);
  });

  test('refuses to exceed the 500-track cap', async () => {
    const full = Array.from({ length: 500 }, (_, i) => track(i + 1, `t${i}`));
    getPlaylistWithTracks.mockResolvedValue(playlist(9, 'Full', full));

    const res = await request(app)
      .post('/api/playlists/tracks/bulk-add')
      .send({ targetPlaylistId: 9, trackIds: [9999] });

    expect(res.status).toBe(200);
    expect(addTracksToPlaylist).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ added: 0, noRoom: 1 });
    expect(res.body.message).toMatch(/full/i);
  });
});

describe('GET /api/library/audit paging', () => {
  test('slices the cached playlist list instead of asking for an offset page', async () => {
    getAllPlaylists.mockResolvedValue(stubs(21));
    getPlaylistWithTracks.mockResolvedValue(playlist(1, 'P', [track(10, 'a')]));

    const res = await request(app).get('/api/library/audit?limit=20&offset=20');

    expect(res.status).toBe(200);
    // /me/playlists declares no offset parameter and marks the shared one
    // deprecated, so asking for one returns page 1 while the UI says 21-40.
    expect(getPlaylists).not.toHaveBeenCalled();
    expect(res.body.page).toMatchObject({ offset: 20, from: 21, to: 21, total: 21, hasMore: false });
  });

  test('a final short page reports its real range and no more to come', async () => {
    getAllPlaylists.mockResolvedValue(stubs(45));
    getPlaylistWithTracks.mockResolvedValue(playlist(1, 'P', [track(10, 'a')]));

    const res = await request(app).get('/api/library/audit?limit=20&offset=40');

    expect(res.status).toBe(200);
    expect(res.body.page).toMatchObject({
      returned: 5, hasMore: false, from: 41, to: 45, total: 45,
    });
  });

  test('rejects a negative offset', async () => {
    const res = await request(app).get('/api/library/audit?offset=-5');
    expect(res.status).toBe(400);
    expect(getAllPlaylists).not.toHaveBeenCalled();
  });
});
