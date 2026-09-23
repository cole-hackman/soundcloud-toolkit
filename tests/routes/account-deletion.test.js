import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);
process.env.SESSION_SECRET ||= 's'.repeat(40);
process.env.APP_URL ||= 'https://www.soundcloudtoolkit.com';
process.env.APP_URLS ||= 'https://www.soundcloudtoolkit.com';

const userDelete = jest.fn().mockResolvedValue({});
const userUpdate = jest.fn().mockResolvedValue({});
const tokenDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
const dropSnapshots = jest.fn().mockResolvedValue(undefined);
const signOut = jest.fn().mockResolvedValue(true);
const forgetRecentRotation = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: {
    user: { delete: userDelete, update: userUpdate },
    token: { deleteMany: tokenDeleteMany },
  },
}));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: {},
  fetchWithTimeout: jest.fn(async () => ({ ok: false, status: 503 })),
  signOut,
  forgetRecentRotation,
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
    req.accessToken = 'live-access-token';
    next();
  },
}));
jest.unstable_mockModule('../../server/middleware/rateLimiter.js', () => ({
  heavyOperationRateLimiter: (_req, _res, next) => next(),
}));

const { default: authRoutes } = await import('../../server/routes/auth.js');
const { rejectUntrustedOrigin } = await import('../../server/middleware/security.js');
const { invalidateUserCollections, invalidationMarkCount, __resetCacheCoordinationForTests } =
  await import('../../server/lib/social-cache.js');
const { requestCache } = await import('../../server/lib/request-cache.js');
const { setCachedAuth, getCachedAuth, clearAuthCache } =
  await import('../../server/lib/auth-cache.js');

// Mirrors server/index.js: express.json(), cookieParser(), then
// rejectUntrustedOrigin on /api. The origin check is the only CSRF guard the
// bodyless disconnect route has, so it has to be in the app under test.
const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/api', rejectUntrustedOrigin);
app.use('/api/auth', authRoutes);

beforeEach(async () => {
  await __resetCacheCoordinationForTests();
  userDelete.mockClear();
  userUpdate.mockClear();
  tokenDeleteMany.mockClear();
  dropSnapshots.mockClear();
  signOut.mockClear();
  forgetRecentRotation.mockClear();
  clearAuthCache();
});

describe('DELETE /api/auth/account', () => {
  test('the auth memo is dropped, through the route', async () => {
    // The memo holds DECRYPTED tokens for 30s. If the route stops dropping it,
    // a request arriving inside that window keeps serving credentials — and
    // writing rows — for an account whose row is already gone.
    //
    // This asserts the ROUTE's behaviour deliberately. Until now the coverage
    // was a comment pointing at tests/routes/auth-cache.test.js, which calls
    // invalidateCachedAuth() by hand: removing the call from the route left
    // every one of those tests green.
    setCachedAuth('user-1', {
      user: { id: 'user-1' },
      accessToken: 'live-access-token',
      refreshToken: 'live-refresh-token',
    });
    setCachedAuth('user-2', { user: { id: 'user-2' }, accessToken: 'x', refreshToken: 'y' });
    expect(getCachedAuth('user-1')).toBeDefined();

    const res = await request(app).delete('/api/auth/account').send({ confirm: 'DELETE' });

    expect(res.status).toBe(200);
    expect(getCachedAuth('user-1')).toBeUndefined();
    // A bystander's memo is untouched — the drop is keyed, not a flush.
    expect(getCachedAuth('user-2')).toBeDefined();
    // The refresh path's rotation memo holds a plaintext pair for a minute for
    // the same reason and is dropped by the same route.
    expect(forgetRecentRotation).toHaveBeenCalledWith('user-1');
  });

  test('nothing about the user survives in process memory', async () => {
    // Populate every in-process structure the deletion path is responsible
    // for: the library memo and the invalidation marks. (The auth memo has its
    // own test above, through this route.)
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

  test('hands the SoundCloud grant back before deleting the row', async () => {
    const res = await request(app).delete('/api/auth/account').send({ confirm: 'DELETE' });

    expect(res.status).toBe(200);
    expect(signOut).toHaveBeenCalledWith('live-access-token');
    // Order matters: once the row is gone we can no longer recover the token.
    expect(signOut.mock.invocationCallOrder[0])
      .toBeLessThan(userDelete.mock.invocationCallOrder[0]);
  });

  test('refuses without the confirmation phrase and touches nothing', async () => {
    invalidateUserCollections('user-1', ['likes']);
    const res = await request(app).delete('/api/auth/account').send({});
    expect(res.status).toBe(400);
    expect(userDelete).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(invalidationMarkCount()).toBe(1);
  });
});

describe('POST /api/auth/disconnect', () => {
  test('signs out upstream, destroys the tokens, and stamps the row', async () => {
    requestCache.set('likes', 'user-1', 'default', { collection: [1] }, 60_000);
    invalidateUserCollections('user-1', ['likes', 'playlists']);
    invalidateUserCollections('user-2', ['likes']);

    const res = await request(app).post('/api/auth/disconnect');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    expect(signOut).toHaveBeenCalledWith('live-access-token');
    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });

    const update = userUpdate.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'user-1' });
    expect(update.data.disconnectedAt).toBeInstanceOf(Date);

    // The account itself survives — that is what separates this from deletion.
    expect(userDelete).not.toHaveBeenCalled();

    // Everything derived from the grant we just gave back is dropped.
    expect(dropSnapshots).toHaveBeenCalledWith('user-1');
    expect(requestCache.get('likes', 'user-1', 'default')).toBeUndefined();
    expect(invalidationMarkCount()).toBe(1); // only the bystander's mark left

    expect(res.headers['set-cookie'].some((c) => c.startsWith('session='))).toBe(true);
  });

  test('a database failure surfaces as a 500, not a half-torn-down session', async () => {
    // The route logs the failure by design; keep the suite's output readable.
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      tokenDeleteMany.mockRejectedValueOnce(new Error('db down'));
      const res = await request(app).post('/api/auth/disconnect');

      expect(res.status).toBe(500);
      expect(userUpdate).not.toHaveBeenCalled();
      expect(quiet).toHaveBeenCalled();
    } finally {
      quiet.mockRestore();
    }
  });

  test('the auth memo is dropped even when a later step fails', async () => {
    // The landmine: the memo holds DECRYPTED tokens for 30s. If the user
    // update throws after the tokens are already deleted, leaving the memo
    // populated would keep serving credentials whose row no longer exists.
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      setCachedAuth('user-1', { user: { id: 'user-1' }, accessToken: 'at', refreshToken: 'rt' });
      expect(getCachedAuth('user-1')).toBeDefined();

      userUpdate.mockRejectedValueOnce(new Error('db down'));
      const res = await request(app).post('/api/auth/disconnect');

      expect(res.status).toBe(500);
      expect(tokenDeleteMany).toHaveBeenCalled();
      expect(getCachedAuth('user-1')).toBeUndefined();
      // The rotation memo in soundcloud-client.js is the same landmine one
      // layer down, and is dropped in the same finally.
      expect(forgetRecentRotation).toHaveBeenCalledWith('user-1');
    } finally {
      quiet.mockRestore();
    }
  });

  // The route takes no body, so the empty-body fail-closed layer that guards
  // the other mutations cannot apply here — rejectUntrustedOrigin is it.
  test('a cross-site POST is refused before the handler runs', async () => {
    const res = await request(app)
      .post('/api/auth/disconnect')
      .set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
    expect(tokenDeleteMany).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  test('a form-encoded cross-site POST is refused the same way', async () => {
    const res = await request(app)
      .post('/api/auth/disconnect')
      .set('Origin', 'https://evil.example.com')
      .type('form')
      .send('confirm=yes');

    expect(res.status).toBe(403);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
  });
});
