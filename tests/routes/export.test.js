import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);
process.env.SESSION_SECRET ||= 's'.repeat(40);
process.env.APP_URL ||= 'https://www.soundcloudtoolkit.com';

// The two ciphertext columns that must never reach the response.
const CIPHERTEXT_ACCESS = 'ENCRYPTED-ACCESS-TOKEN-CIPHERTEXT';
const CIPHERTEXT_REFRESH = 'ENCRYPTED-REFRESH-TOKEN-CIPHERTEXT';
const TOKEN_EXPIRY = new Date('2026-10-01T00:00:00.000Z');

// Every delegate returns rows so a missing scope shows up as a leak rather
// than as an empty array that happens to look correct.
const findMany = (rows) => jest.fn().mockResolvedValue(rows);

const tokenFindFirst = jest.fn();
const operationLogFindMany = findMany([{ id: 'op-1', userId: 'user-a', action: 'merge' }]);
const growthActionFindMany = findMany([{ id: 'g-1', userId: 'user-a', targetId: 10n }]);
const feedbackFindMany = findMany([{ id: 'f-1', userId: 'user-a', body: 'nice' }]);
const rebrandVoteFindMany = findMany([{ id: 'r-1', userId: 'user-a', soundcloudId: 555n }]);
const surveyResponseFindMany = findMany([{ id: 's-1', userId: 'user-a', soundcloudId: 555n }]);
const betaSignupFindMany = findMany([{ id: 'b-1', userId: 'user-a', email: 'dj@example.com' }]);
const cacheStateFindMany = findMany([{ id: 'st-1', userId: 'user-a', resource: 'likes' }]);
const cachePageFindMany = findMany([
  { resource: 'likes', pageIndex: 0, itemCount: 2, items: [{ id: 1 }, { id: 2 }] },
]);

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: {
    token: { findFirst: tokenFindFirst },
    operationLog: { findMany: operationLogFindMany },
    growthAction: { findMany: growthActionFindMany },
    feedback: { findMany: feedbackFindMany },
    rebrandVote: { findMany: rebrandVoteFindMany },
    surveyResponse: { findMany: surveyResponseFindMany },
    betaSignup: { findMany: betaSignupFindMany },
    libraryCacheState: { findMany: cacheStateFindMany },
    libraryCachePage: { findMany: cachePageFindMany },
  },
}));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: {},
  fetchWithTimeout: jest.fn(async () => ({ ok: false, status: 503 })),
  signOut: jest.fn(async () => true),
}));
jest.unstable_mockModule('../../server/lib/analytics.js', () => ({
  logOperation: jest.fn(),
  startOperationTimer: () => () => 0,
  extractClientInfo: () => ({}),
  getAnalyticsWriteHealth: jest.fn(),
}));
jest.unstable_mockModule('../../server/lib/snapshot-cache.js', () => ({
  dropSnapshots: jest.fn().mockResolvedValue(undefined),
  readSnapshot: jest.fn(),
  writeSnapshot: jest.fn(),
  invalidateSnapshot: jest.fn().mockResolvedValue({ count: 0 }),
  SNAPSHOT_RESOURCES: ['likes', 'playlists', 'followings', 'followers', 'reposts'],
}));
jest.unstable_mockModule('../../server/middleware/rateLimiter.js', () => ({
  heavyOperationRateLimiter: (_req, _res, next) => next(),
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  // Shaped like the real middleware: req.user is the full row WITH its tokens
  // included, which is exactly why the route must pick fields rather than
  // spread it.
  authenticateUser: (req, _res, next) => {
    req.user = {
      id: 'user-a',
      soundcloudId: 555,
      username: 'dj',
      displayName: 'DJ',
      avatarUrl: 'https://cdn/a.jpg',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      lastLoginAt: new Date('2026-09-01T00:00:00.000Z'),
      disconnectedAt: null,
      tokens: [{
        id: 'tok-1',
        userId: 'user-a',
        encrypted: CIPHERTEXT_ACCESS,
        refresh: CIPHERTEXT_REFRESH,
        expiresAt: TOKEN_EXPIRY,
      }],
    };
    req.accessToken = 'PLAINTEXT-ACCESS-TOKEN';
    req.refreshToken = 'PLAINTEXT-REFRESH-TOKEN';
    next();
  },
}));

// BigInt columns (growth target ids, the vote tables' soundcloudId) would make
// JSON.stringify throw; server/index.js patches this globally in production.
BigInt.prototype.toJSON = function () { return Number(this); };

const { default: authRoutes } = await import('../../server/routes/auth.js');

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use('/api/auth', authRoutes);

const allQueries = [
  ['operationLog', operationLogFindMany],
  ['growthAction', growthActionFindMany],
  ['feedback', feedbackFindMany],
  ['rebrandVote', rebrandVoteFindMany],
  ['surveyResponse', surveyResponseFindMany],
  ['betaSignup', betaSignupFindMany],
  ['libraryCacheState', cacheStateFindMany],
  ['libraryCachePage', cachePageFindMany],
];

beforeEach(() => {
  tokenFindFirst.mockClear().mockResolvedValue({ expiresAt: TOKEN_EXPIRY });
  for (const [, mock] of allQueries) mock.mockClear();
});

describe('GET /api/auth/export — scoping', () => {
  test('every query is scoped to the session user', async () => {
    const res = await request(app).get('/api/auth/export');
    expect(res.status).toBe(200);

    for (const [name, mock] of allQueries) {
      expect(mock).toHaveBeenCalledTimes(1);
      const { where } = mock.mock.calls[0][0];
      // Named in the assertion so a failure says which table lost its scope.
      expect({ [name]: where }).toEqual({ [name]: expect.objectContaining({ userId: 'user-a' }) });
    }

    expect(tokenFindFirst.mock.calls[0][0].where).toEqual({ userId: 'user-a' });
  });

  test('takes no user identifier from the request', async () => {
    // A query string must not be able to redirect the export at someone else.
    await request(app).get('/api/auth/export?userId=user-b&id=user-b');

    for (const [, mock] of allQueries) {
      expect(mock.mock.calls[0][0].where.userId).toBe('user-a');
    }
  });
});

describe('GET /api/auth/export — token secrets', () => {
  test('the token ciphertext never appears anywhere in the payload', async () => {
    const res = await request(app).get('/api/auth/export');

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(CIPHERTEXT_ACCESS);
    expect(serialized).not.toContain(CIPHERTEXT_REFRESH);
    expect(serialized).not.toContain('PLAINTEXT-ACCESS-TOKEN');
    expect(serialized).not.toContain('PLAINTEXT-REFRESH-TOKEN');
    expect(serialized).not.toMatch(/"encrypted"|"refresh"/);
  });

  test('the token block is expiry and nothing else', async () => {
    const res = await request(app).get('/api/auth/export');
    expect(Object.keys(res.body.token)).toEqual(['expiresAt']);
    expect(res.body.token.expiresAt).toBe(TOKEN_EXPIRY.toISOString());
  });

  test('the token query asks the database for expiry only', async () => {
    await request(app).get('/api/auth/export');
    // Defence in depth: the ciphertext never even leaves Postgres.
    expect(tokenFindFirst.mock.calls[0][0].select).toEqual({ expiresAt: true });
  });

  test('a disconnected user with no token row exports token: null', async () => {
    tokenFindFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/auth/export');
    expect(res.body.token).toBeNull();
  });

  test('the user block carries no tokens relation', async () => {
    const res = await request(app).get('/api/auth/export');
    expect(res.body.user.tokens).toBeUndefined();
    expect(Object.keys(res.body.user).sort()).toEqual([
      'avatarUrl', 'createdAt', 'displayName', 'id', 'lastLoginAt', 'soundcloudId', 'username',
    ]);
  });
});

describe('GET /api/auth/export — response shape', () => {
  test('sets the dated attachment header', async () => {
    const res = await request(app).get('/api/auth/export');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="track-toolkit-export-\d{4}-\d{2}-\d{2}\.json"$/
    );
  });

  test('carries every section plus its schema version', async () => {
    const res = await request(app).get('/api/auth/export');

    expect(res.body.schemaVersion).toBe(1);
    expect(typeof res.body.generatedAt).toBe('string');
    for (const key of [
      'user', 'token', 'operationLogs', 'growthActions', 'feedback', 'rebrandVotes',
      'surveyResponses', 'betaSignups', 'libraryCacheState', 'libraryCachePages',
    ]) {
      expect(res.body).toHaveProperty(key);
    }
  });

  test('BigInt columns survive serialization', async () => {
    const res = await request(app).get('/api/auth/export');
    expect(res.body.growthActions[0].targetId).toBe(10);
    expect(res.body.rebrandVotes[0].soundcloudId).toBe(555);
  });

  test('cache pages carry their items, not just their counts', async () => {
    const res = await request(app).get('/api/auth/export');
    expect(res.body.libraryCachePages[0]).toEqual({
      resource: 'likes', pageIndex: 0, itemCount: 2, items: [{ id: 1 }, { id: 2 }],
    });
    expect(cachePageFindMany.mock.calls[0][0].select).toEqual({
      resource: true, pageIndex: true, itemCount: true, items: true,
    });
  });
});
