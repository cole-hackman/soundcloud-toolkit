import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';

const getAllPlaylists = jest.fn();
const getPlaylistWithTracks = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { getAllPlaylists, getPlaylistWithTracks },
  fetchWithTimeout: jest.fn(async () => ({ ok: false, status: 503 })),
}));
jest.unstable_mockModule('../../server/lib/snapshot-cache.js', () => ({
  readSnapshot: jest.fn().mockResolvedValue(null),
  writeSnapshot: jest.fn().mockResolvedValue({ pages: 1, items: 1 }),
  invalidateSnapshot: jest.fn().mockResolvedValue({ count: 0 }),
  dropSnapshots: jest.fn(),
  SNAPSHOT_RESOURCES: ['likes', 'playlists', 'followings', 'followers', 'reposts'],
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
const { requestCache } = await import('../../server/lib/request-cache.js');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

beforeEach(() => {
  requestCache.invalidateUser('user-a');
  getAllPlaylists.mockReset();
  getPlaylistWithTracks.mockReset();
});

afterAll(() => { process.env.NODE_ENV = originalNodeEnv; });

describe('GET /api/playlists cover art', () => {
  test('never fetches a playlist body to derive a cover', async () => {
    // The regression this guards: an unbounded Promise.all of
    // getPlaylistWithTracks — 50 concurrent requests each pulling up to 500
    // track objects — purely to read tracks[0].artwork_url.
    getAllPlaylists.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: i, title: `p${i}`, artwork_url: null, user: { avatar_url: 'https://cdn/avatar.jpg' },
      })),
    );

    const res = await request(app).get('/api/playlists');

    expect(res.status).toBe(200);
    expect(res.body.collection).toHaveLength(50);
    expect(getAllPlaylists).toHaveBeenCalledTimes(1);
    expect(getPlaylistWithTracks).not.toHaveBeenCalled();
  });

  test('prefers the playlist artwork and falls back to the owner avatar', async () => {
    getAllPlaylists.mockResolvedValue([
      { id: 1, artwork_url: 'https://cdn/art.jpg', user: { avatar_url: 'https://cdn/a.jpg' } },
      { id: 2, artwork_url: null, user: { avatar_url: 'https://cdn/b.jpg' } },
      { id: 3, artwork_url: null, user: {} },
    ]);

    const { body } = await request(app).get('/api/playlists');

    expect(body.collection[0].coverUrl).toBe('https://cdn/art.jpg');
    expect(body.collection[1].coverUrl).toBe('https://cdn/b.jpg');
    expect(body.collection[2].coverUrl).toBe(''); // never undefined
  });

  test('normalizes string ids to numbers', async () => {
    getAllPlaylists.mockResolvedValue([{ id: '42', artwork_url: 'x', user: {} }]);
    const { body } = await request(app).get('/api/playlists');
    expect(body.collection[0].id).toBe(42);
  });

  test('a second request inside the TTL does not re-crawl', async () => {
    getAllPlaylists.mockResolvedValue([{ id: 1, artwork_url: 'x', user: {} }]);
    await request(app).get('/api/playlists');
    await request(app).get('/api/playlists');
    expect(getAllPlaylists).toHaveBeenCalledTimes(1);
  });
});
