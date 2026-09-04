import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;
process.env.ENCRYPTION_KEY = 'x'.repeat(32);
process.env.SESSION_SECRET = 's'.repeat(40);

const findUnique = jest.fn();
jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { user: { findUnique }, token: { update: jest.fn() } },
}));

const { encrypt } = await import('../../server/lib/crypto.js');
const { signSession } = await import('../../server/lib/session.js');
const { authenticateUser } = await import('../../server/middleware/auth.js');
const { clearAuthCache, invalidateCachedAuth, authCacheSize } =
  await import('../../server/lib/auth-cache.js');

const KEY = process.env.ENCRYPTION_KEY;

const app = express();
app.use(cookieParser());
app.get('/probe', authenticateUser, (req, res) => {
  res.json({
    userId: req.user.id,
    accessToken: req.accessToken,
    refreshToken: req.refreshToken,
  });
});

function sessionCookie(userId = 'user-1') {
  const value = JSON.stringify({ userId, soundcloudId: 111, iat: Date.now() });
  return `session=${encodeURIComponent(signSession(value, process.env.SESSION_SECRET))}`;
}

function userRow(id, access, refresh) {
  return {
    id,
    soundcloudId: 111,
    tokens: [{ encrypted: encrypt(access, KEY), refresh: encrypt(refresh, KEY) }],
  };
}

beforeEach(() => {
  clearAuthCache();
  findUnique.mockReset();
});

afterAll(() => {
  process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
  process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
});

describe('authenticateUser memo', () => {
  test('repeat requests for one session hit the database once', async () => {
    findUnique.mockResolvedValue(userRow('user-1', 'at-1', 'rt-1'));

    for (let i = 0; i < 4; i += 1) {
      const res = await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('at-1');
    }
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  test('two users never read each other\'s entry', async () => {
    findUnique.mockImplementation(({ where }) =>
      Promise.resolve(userRow(where.id, `at-${where.id}`, `rt-${where.id}`)));

    const a = await request(app).get('/probe').set('Cookie', sessionCookie('user-a'));
    const b = await request(app).get('/probe').set('Cookie', sessionCookie('user-b'));
    const a2 = await request(app).get('/probe').set('Cookie', sessionCookie('user-a'));

    expect(a.body.accessToken).toBe('at-user-a');
    expect(b.body.accessToken).toBe('at-user-b');
    expect(a2.body.accessToken).toBe('at-user-a'); // served from memo, still correct
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  test('invalidation forces a fresh read — this is what token refresh relies on', async () => {
    findUnique.mockResolvedValueOnce(userRow('user-1', 'at-old', 'rt-old'));
    const first = await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
    expect(first.body.refreshToken).toBe('rt-old');

    // SoundCloud rotates the refresh token on every exchange; the refresh path
    // calls invalidateCachedAuth after persisting the new pair.
    invalidateCachedAuth('user-1');
    findUnique.mockResolvedValueOnce(userRow('user-1', 'at-new', 'rt-new'));

    const second = await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
    expect(second.body.refreshToken).toBe('rt-new');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  test('the memo entry expires', async () => {
    jest.useFakeTimers();
    try {
      findUnique.mockResolvedValue(userRow('user-1', 'at-1', 'rt-1'));
      await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
      expect(findUnique).toHaveBeenCalledTimes(1);

      jest.setSystemTime(Date.now() + 60_000); // past the default 30s TTL
      await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
      expect(findUnique).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a session for a deleted user still 401s once the memo is dropped', async () => {
    findUnique.mockResolvedValueOnce(userRow('user-1', 'at-1', 'rt-1'));
    expect((await request(app).get('/probe').set('Cookie', sessionCookie('user-1'))).status).toBe(200);

    invalidateCachedAuth('user-1');          // account deletion does this
    findUnique.mockResolvedValueOnce(null);  // row is gone

    const res = await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
    expect(res.status).toBe(401);
  });

  test('a request with no session never populates or reads the memo', async () => {
    const res = await request(app).get('/probe');
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(authCacheSize()).toBe(0);
  });

  test('a forged session signature is rejected before the memo is consulted', async () => {
    findUnique.mockResolvedValue(userRow('user-1', 'at-1', 'rt-1'));
    // Prime the memo through a legitimate request...
    await request(app).get('/probe').set('Cookie', sessionCookie('user-1'));
    findUnique.mockClear();

    // ...then present a cookie whose signature does not verify. The memo must
    // not be reachable by anyone who cannot produce a valid signature.
    const forged = `session=${encodeURIComponent('{"userId":"user-1"}.deadbeef')}`;
    const res = await request(app).get('/probe').set('Cookie', forged);
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
