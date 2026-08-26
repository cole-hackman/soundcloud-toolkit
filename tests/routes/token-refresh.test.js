import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Response } from 'node-fetch';

// Capture original env before overwriting
const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ORIGINAL_SESSION_SECRET = process.env.SESSION_SECRET;

process.env.ENCRYPTION_KEY = 'x'.repeat(32);
process.env.SESSION_SECRET = 's'.repeat(40);

const tokenUpdate = jest.fn().mockResolvedValue({});
const findUnique = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { user: { findUnique }, token: { update: tokenUpdate } },
}));

const { encrypt } = await import('../../server/lib/crypto.js');
const { signSession } = await import('../../server/lib/session.js');
const { authenticateUser } = await import('../../server/middleware/auth.js');
const { soundcloudClient } = await import('../../server/lib/soundcloud-client.js');

const KEY = process.env.ENCRYPTION_KEY;

const app = express();
app.use(cookieParser());
app.get('/probe', authenticateUser, async (req, res) => {
  try {
    const data = await soundcloudClient.scRequest('/me', req.accessToken, req.refreshToken);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function sessionCookie(userId = 'user-1') {
  const value = JSON.stringify({ userId, soundcloudId: 111, iat: Date.now() });
  return `session=${encodeURIComponent(signSession(value, process.env.SESSION_SECRET))}`;
}

const originalFetch = global.fetch;

beforeEach(() => {
  tokenUpdate.mockClear();
  findUnique.mockClear();
  findUnique.mockResolvedValue({
    id: 'user-1',
    soundcloudId: 111,
    tokens: [{
      encrypted: encrypt('stale-access', KEY),
      refresh: encrypt('good-refresh', KEY),
    }],
  });
  global.fetch = jest.fn();
});

afterAll(() => {
  if (ORIGINAL_ENCRYPTION_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
  if (ORIGINAL_SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = ORIGINAL_SESSION_SECRET;
  global.fetch = originalFetch;
});

describe('401 → refresh → persist → retry, through the real middleware', () => {
  test('the refreshed token pair is persisted for the session user and the retry succeeds', async () => {
    fetch
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 401 })))
      .mockReturnValueOnce(Promise.resolve(new Response(
        JSON.stringify({ access_token: 'fresh-access', refresh_token: 'fresh-refresh', expires_in: 3600 }),
        { status: 200 }
      )))
      .mockReturnValueOnce(Promise.resolve(new Response(
        JSON.stringify({ id: 111, username: 'dj' }), { status: 200 }
      )));

    const res = await request(app).get('/probe').set('Cookie', sessionCookie());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 111, username: 'dj' });
    expect(fetch).toHaveBeenCalledTimes(3);

    // persisted against the SESSION's user, sourced from the token context
    expect(tokenUpdate).toHaveBeenCalledTimes(1);
    const call = tokenUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ userId: 'user-1' });

    // stored encrypted, never in plaintext
    expect(call.data.encrypted).not.toBe('fresh-access');
    expect(call.data.refresh).not.toBe('fresh-refresh');
    expect(call.data.expiresAt).toBeInstanceOf(Date);
  });

  test('the first request carries the DECRYPTED access token, not the ciphertext', async () => {
    fetch.mockReturnValue(Promise.resolve(new Response(JSON.stringify({ id: 111 }), { status: 200 })));

    await request(app).get('/probe').set('Cookie', sessionCookie());

    const auth = fetch.mock.calls[0][1].headers.Authorization;
    expect(auth).toBe('OAuth stale-access');
  });

  test('a failed refresh surfaces a generic error and persists nothing', async () => {
    fetch
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 401 })))
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 400 })));

    const res = await request(app).get('/probe').set('Cookie', sessionCookie());

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Token refresh failed');
    expect(res.body.error).not.toMatch(/good-refresh|fresh-access/);
    expect(tokenUpdate).not.toHaveBeenCalled();
  });
});

describe('session gating', () => {
  test('no session cookie never reaches SoundCloud', async () => {
    const res = await request(app).get('/probe');
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('a legacy cookie with no iat is rejected (post-hardening behavior)', async () => {
    const legacy = signSession(JSON.stringify({ userId: 'user-1' }), process.env.SESSION_SECRET);
    const res = await request(app).get('/probe').set('Cookie', `session=${encodeURIComponent(legacy)}`);
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
