import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);
process.env.SESSION_SECRET ||= 's'.repeat(40);
process.env.APP_URL ||= 'https://www.soundcloudtoolkit.com';

const userDelete = jest.fn().mockResolvedValue({});
const dropSnapshots = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { user: { delete: userDelete } },
}));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: {},
  fetchWithTimeout: jest.fn(async () => ({ ok: false, status: 503 })),
}));
jest.unstable_mockModule('../../server/lib/analytics.js', () => ({
  logOperation: jest.fn(),
  startOperationTimer: () => () => 0,
  extractClientInfo: () => ({}),
  getAnalyticsWriteHealth: jest.fn(),
}));
jest.unstable_mockModule('../../server/lib/snapshot-cache.js', () => ({
  dropSnapshots,
  readSnapshot: jest.fn(),
  writeSnapshot: jest.fn(),
  invalidateSnapshot: jest.fn().mockResolvedValue({ count: 0 }),
  SNAPSHOT_RESOURCES: ['likes', 'playlists', 'followings', 'followers', 'reposts'],
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: (req, _res, next) => {
    req.user = { id: 'user-1', soundcloudId: 555 };
    next();
  },
}));

const { default: authRoutes } = await import('../../server/routes/auth.js');
const { invalidateUserCollections, invalidationMarkCount, __resetCacheCoordinationForTests } =
  await import('../../server/lib/social-cache.js');
const { requestCache } = await import('../../server/lib/request-cache.js');

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/api/auth', authRoutes);

beforeEach(async () => {
  await __resetCacheCoordinationForTests();
  userDelete.mockClear();
  dropSnapshots.mockClear();
});

describe('DELETE /api/auth/account', () => {
  test('nothing about the user survives in process memory', async () => {
    // Populate every in-process structure the deletion path is responsible
    // for: the library memo and the invalidation marks. (The auth memo is
    // covered by tests/routes/auth-cache.test.js.)
    requestCache.set('likes', 'user-1', 'default', { collection: [1] }, 60_000);
    invalidateUserCollections('user-1', ['likes', 'playlists']);
    invalidateUserCollections('user-2', ['likes']);         // a bystander
    expect(invalidationMarkCount()).toBe(3);

    const res = await request(app).delete('/api/auth/account').send({ confirm: 'DELETE' });

    expect(res.status).toBe(200);
    expect(userDelete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(dropSnapshots).toHaveBeenCalledWith('user-1');
    expect(requestCache.get('likes', 'user-1', 'default')).toBeUndefined();
    // The marks map is the one the earlier deletion path forgot. Only the
    // deleted user's entries go; the bystander's stays.
    expect(invalidationMarkCount()).toBe(1);
  });

  test('refuses without the confirmation phrase and touches nothing', async () => {
    invalidateUserCollections('user-1', ['likes']);
    const res = await request(app).delete('/api/auth/account').send({});
    expect(res.status).toBe(400);
    expect(userDelete).not.toHaveBeenCalled();
    expect(invalidationMarkCount()).toBe(1);
  });
});
