import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Capture original env vars before setting test values
const originalNodeEnv = process.env.NODE_ENV;
const originalAppUrls = process.env.APP_URLS;

process.env.NODE_ENV = 'development'; // disables rate limiters
process.env.APP_URLS = 'https://www.soundcloudtoolkit.com';

const unlikeTrack = jest.fn().mockResolvedValue({});
const getPlaylistWithTracks = jest.fn().mockResolvedValue({ tracks: [] });

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { unlikeTrack, getPlaylistWithTracks },
}));
jest.unstable_mockModule('../../server/lib/analytics.js', () => ({
  logOperation: jest.fn(),
  startOperationTimer: jest.fn(() => () => 42),
  extractClientInfo: jest.fn(() => ({})),
  getAnalyticsWriteHealth: jest.fn().mockResolvedValue({ healthy: true }),
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
const { rejectUntrustedOrigin } = await import('../../server/middleware/security.js');

// Mirrors server/index.js exactly (lines 103-107, 132):
// 1. express.json() globally
// 2. cookieParser() globally
// 3. rejectUntrustedOrigin on /api
// 4. router on /api
// No express.urlencoded() — that absence is the invariant.
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api', rejectUntrustedOrigin);
app.use('/api', apiRoutes);

beforeEach(() => { unlikeTrack.mockClear(); });

afterAll(() => {
  // Restore original env vars
  if (originalNodeEnv !== undefined) {
    process.env.NODE_ENV = originalNodeEnv;
  } else {
    delete process.env.NODE_ENV;
  }
  if (originalAppUrls !== undefined) {
    process.env.APP_URLS = originalAppUrls;
  } else {
    delete process.env.APP_URLS;
  }
});

describe('layer 1 — untrusted Origin is rejected outright', () => {
  test('bulk-unlike from an attacker origin is 403 before any handler runs', async () => {
    const res = await request(app)
      .post('/api/likes/tracks/bulk-unlike')
      .set('Origin', 'https://evil.example.com')
      .send({ trackIds: [1, 2, 3] });

    expect(res.status).toBe(403);
    expect(unlikeTrack).not.toHaveBeenCalled();
  });

  test('merge from an attacker origin is 403', async () => {
    const res = await request(app)
      .post('/api/playlists/merge')
      .set('Origin', 'https://evil.example.com')
      .send({ sourcePlaylistIds: [1, 2] });

    expect(res.status).toBe(403);
    expect(getPlaylistWithTracks).not.toHaveBeenCalled();
  });
});

describe('layer 2 — form-encoded bodies fail closed even with no Origin header', () => {
  // A cross-site <form> post sends no preflight and may omit Origin in older
  // browsers. express.json() ignores urlencoded, so req.body is empty and the
  // validator rejects. This is the invariant documented in docs/SECURITY.md.
  test('form-encoded bulk-unlike is rejected and unlikes nothing', async () => {
    const res = await request(app)
      .post('/api/likes/tracks/bulk-unlike')
      .type('form')
      .send('trackIds[]=1&trackIds[]=2');

    expect(res.status).toBe(400);
    expect(unlikeTrack).not.toHaveBeenCalled();
  });

  test('form-encoded merge is rejected and creates nothing', async () => {
    const res = await request(app)
      .post('/api/playlists/merge')
      .type('form')
      .send('sourcePlaylistIds[]=1&sourcePlaylistIds[]=2');

    expect(res.status).toBe(400);
    expect(getPlaylistWithTracks).not.toHaveBeenCalled();
  });

  test('text/plain bulk-unlike (the classic no-preflight CSRF vector) is rejected', async () => {
    const res = await request(app)
      .post('/api/likes/tracks/bulk-unlike')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify({ trackIds: [1, 2, 3] }));

    expect(res.status).toBe(400);
    expect(unlikeTrack).not.toHaveBeenCalled();
  });
});

describe('the legitimate path still works', () => {
  test('a JSON bulk-unlike from an allowlisted origin succeeds', async () => {
    const res = await request(app)
      .post('/api/likes/tracks/bulk-unlike')
      .set('Origin', 'https://www.soundcloudtoolkit.com')
      .send({ trackIds: [1] });

    expect(res.status).toBe(200);
    expect(unlikeTrack).toHaveBeenCalledTimes(1);
  });
});
