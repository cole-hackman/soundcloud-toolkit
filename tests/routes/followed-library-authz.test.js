import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'development'; // disables rate limiters

const getFollowings = jest.fn();
const getUserLikedTracksPage = jest.fn();
const getUserPlaylistsPage = jest.fn();
const getUserLikedPlaylistsPage = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: {
    getFollowings,
    getUserLikedTracksPage,
    getUserPlaylistsPage,
    getUserLikedPlaylistsPage,
  },
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

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const PAGED_ROUTES = [
  ['/api/followings/999/likes/paged', 'getUserLikedTracksPage'],
  ['/api/followings/999/playlists/paged', 'getUserPlaylistsPage'],
  ['/api/followings/999/liked-playlists/paged', 'getUserLikedPlaylistsPage'],
];

beforeEach(() => {
  getFollowings.mockClear();
  getUserLikedTracksPage.mockClear().mockResolvedValue({ collection: [], next_href: null });
  getUserPlaylistsPage.mockClear().mockResolvedValue({ collection: [], next_href: null });
  getUserLikedPlaylistsPage.mockClear().mockResolvedValue({ collection: [], next_href: null });
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

const clients = { getUserLikedTracksPage, getUserPlaylistsPage, getUserLikedPlaylistsPage };

describe('followed-user library pages are gated on an actual following edge', () => {
  test.each(PAGED_ROUTES)(
    '%s returns 403 and never calls SoundCloud when the target is not followed',
    async (route, clientMethod) => {
      getFollowings.mockResolvedValue([{ id: 222 }, { id: 333 }]); // 999 absent
      const res = await request(app).get(route);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/user you follow/i);
      // the authorization check runs BEFORE any data fetch
      expect(clients[clientMethod]).not.toHaveBeenCalled();
    }
  );

  test.each(PAGED_ROUTES)(
    '%s returns 200 when the target IS followed',
    async (route, clientMethod) => {
      getFollowings.mockResolvedValue([{ id: 999, username: 'friend' }]);
      const res = await request(app).get(route);

      expect(res.status).toBe(200);
      expect(clients[clientMethod]).toHaveBeenCalledTimes(1);
      expect(res.body.user).toMatchObject({ id: 999 });
    }
  );

  test('an empty followings list authorizes nobody', async () => {
    getFollowings.mockResolvedValue([]);
    const res = await request(app).get('/api/followings/999/likes/paged');
    expect(res.status).toBe(403);
  });

  test('a string/number id mismatch still authorizes correctly (Number() coercion)', async () => {
    getFollowings.mockResolvedValue([{ id: '999', username: 'friend' }]);
    const res = await request(app).get('/api/followings/999/likes/paged');
    expect(res.status).toBe(200);
  });
});
