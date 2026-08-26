# Audit Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every remaining item from `docs/engineering-review-2026-08-25.md` that the first remediation pass deferred or missed — the two uncovered P0 tests, all P1/P2 test gaps, the concurrent-refresh mutex, Phase 4 measurement, and the Phase 5 portfolio sweep — so the audit has zero open items.

**Architecture:** No new layers and no new production dependencies. Tests reuse the `tests/routes/` mini-app + `jest.unstable_mockModule` harness established in PR #29. The one production code change is a per-user refresh mutex inside `server/lib/soundcloud-client.js` (a module-level `Map<userId, Promise>`, same in-memory single-instance assumption as the resolve cache and growth job registry). The benchmark is a throwaway script, not a committed dependency.

**Tech Stack:** Node ESM (`"type": "module"`), Express 4, Prisma 5, Jest 29 (`NODE_OPTIONS=--experimental-vm-modules`), supertest (already a devDependency as of PR #29).

**Spec:** `docs/engineering-review-2026-08-25.md` — specifically §5 Test Gaps (P0 #2–#3, P1 #6, all P2), §7 Resume Evidence Report (the "concurrent-refresh mutex" row), §8 Phase 4 and Phase 5.

## Global Constraints

- Branch off `engineering-review-remediation`, **not** `main`: `git checkout engineering-review-remediation && git checkout -b audit-completion`. PR #29 is not merged; branching off `main` loses every module this plan imports (`lib/pacing.js`, `lib/normalize.js`, `routes/growth.js`, `tests/routes/`).
- `npm test` (from the repo root, never from `frontend-UI/`) must stay green after EVERY task. Baseline entering this plan: **26 suites, 176 tests**.
- ESM project: Jest mocking MUST use `jest.unstable_mockModule(...)` followed by dynamic `await import(...)`. `jest.mock()` does not work. Top-level `await` works in test files.
- Do not touch anything under "Decisions" in `STATE.md` — including the four decisions added 2026-08-25 (traceable public numbers, CLAUDE.md-as-sole-brief, `express.json()`-only body parser, no server-side session revocation list).
- No new production dependencies. Any benchmarking tool is run via `npx` and never added to `package.json`.
- Commit after each task with the exact message given. End every commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Tests assert what the code does, not what the review assumed.** The review's §5 P0 #3 says "missing code → 400"; the actual handler 302-redirects to `/login?error=missing_code_or_verifier` (`server/routes/auth.js:104-109`). Task 1 asserts the real behavior. If any other task finds the same kind of mismatch, assert reality and note the discrepancy in the commit body — do not change production behavior to match the review.
- Cole's inputs needed before Tasks 6 and 8 (see "What I Need From Cole" at the bottom). Every other task is unblocked.

---

### Task 1: OAuth callback route tests (review §5 P0 #3)

**Files:**
- Test: `tests/routes/auth-callback.test.js`

**Interfaces:**
- Consumes: `auth` router default export from `server/routes/auth.js`; `prisma` **default** export from `server/lib/prisma.js`; `soundcloudClient` named export from `server/lib/soundcloud-client.js`; `signSession`/`unsignSession`/`parseSessionData` from `server/lib/session.js`.
- Produces: nothing consumed by later tasks.

**Behavior recorded from `server/routes/auth.js:89-190` (source of truth, not the review):**
- `?error=access_denied` → 302 to `${appUrl}/login?error=access_denied`, clears 3 cookies.
- Missing `code` OR missing `pkce_verifier` cookie → 302 to `${appUrl}/login?error=missing_code_or_verifier`. **Not a 400.**
- Happy path → exchanges code, fetches `/me`, upserts `User` then `Token`, sets a signed `session` cookie, redirects.
- `appUrl` comes from the `app_url` cookie, falling back to `process.env.APP_URL`.

- [ ] **Step 1: Write the test file**

Create `tests/routes/auth-callback.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);
process.env.SESSION_SECRET ||= 's'.repeat(40);
process.env.APP_URL ||= 'https://www.soundcloudtoolkit.com';

const userUpsert = jest.fn().mockResolvedValue({
  id: 'user-1',
  soundcloudId: 555,
  username: 'dj',
  displayName: 'DJ',
  avatarUrl: 'https://cdn/a.jpg',
});
const tokenUpsert = jest.fn().mockResolvedValue({});
const exchangeCodeForTokens = jest.fn();
const getMe = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { user: { upsert: userUpsert }, token: { upsert: tokenUpsert } },
}));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { exchangeCodeForTokens, getMe },
}));
jest.unstable_mockModule('../../server/lib/analytics.js', () => ({
  logOperation: jest.fn(),
  startOperationTimer: () => () => 0,
  extractClientInfo: () => ({}),
}));

const { default: authRoutes } = await import('../../server/routes/auth.js');
const { unsignSession, parseSessionData } = await import('../../server/lib/session.js');

const app = express();
app.use(cookieParser());
app.use('/api/auth', authRoutes);

beforeEach(() => {
  userUpsert.mockClear();
  tokenUpsert.mockClear();
  exchangeCodeForTokens.mockClear().mockResolvedValue({
    access_token: 'at', refresh_token: 'rt', expires_in: 3600,
  });
  getMe.mockClear().mockResolvedValue({
    id: 555, username: 'dj', display_name: 'DJ', avatar_url: 'https://cdn/a.jpg',
  });
});

describe('OAuth callback — happy path', () => {
  test('upserts the user, stores encrypted tokens, and sets a valid signed session cookie', async () => {
    const res = await request(app)
      .get('/api/auth/callback?code=abc123')
      .set('Cookie', ['pkce_verifier=verifier-value', 'app_url=https://app.example.com']);

    expect(res.status).toBe(302);
    expect(exchangeCodeForTokens).toHaveBeenCalledWith('abc123', 'verifier-value');

    // user upserted by soundcloudId, not by any client-supplied value
    expect(userUpsert).toHaveBeenCalledTimes(1);
    expect(userUpsert.mock.calls[0][0].where).toEqual({ soundcloudId: 555 });

    // tokens persisted, and NOT in plaintext
    expect(tokenUpsert).toHaveBeenCalledTimes(1);
    const tokenData = tokenUpsert.mock.calls[0][0].create;
    expect(tokenData.encrypted).not.toBe('at');
    expect(tokenData.refresh).not.toBe('rt');

    // session cookie is signed and carries iat
    const setCookie = res.headers['set-cookie'].find((c) => c.startsWith('session='));
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
    const raw = decodeURIComponent(setCookie.split(';')[0].slice('session='.length));
    const payload = parseSessionData(unsignSession(raw, process.env.SESSION_SECRET));
    expect(payload).toMatchObject({ userId: 'user-1', soundcloudId: 555 });
    expect(typeof payload.iat).toBe('number');
  });
});

describe('OAuth callback — failure paths never create a session', () => {
  test('a provider error redirects to /login with the error and sets no session', async () => {
    const res = await request(app)
      .get('/api/auth/callback?error=access_denied')
      .set('Cookie', ['app_url=https://app.example.com']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://app.example.com/login?error=access_denied');
    expect(userUpsert).not.toHaveBeenCalled();
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('session='))).toBe(false);
  });

  test('a missing PKCE verifier cookie cannot complete the exchange', async () => {
    const res = await request(app)
      .get('/api/auth/callback?code=abc123')
      .set('Cookie', ['app_url=https://app.example.com']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      'https://app.example.com/login?error=missing_code_or_verifier'
    );
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
    expect(userUpsert).not.toHaveBeenCalled();
  });

  test('a missing code cannot complete the exchange', async () => {
    const res = await request(app)
      .get('/api/auth/callback')
      .set('Cookie', ['pkce_verifier=verifier-value', 'app_url=https://app.example.com']);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      'https://app.example.com/login?error=missing_code_or_verifier'
    );
    expect(exchangeCodeForTokens).not.toHaveBeenCalled();
  });
});

describe('OAuth login — PKCE challenge', () => {
  test('sets an httpOnly pkce_verifier cookie and redirects with an S256 challenge', async () => {
    const res = await request(app)
      .get('/api/auth/login')
      .set('Origin', 'https://app.example.com');

    expect(res.status).toBe(302);
    const cookies = res.headers['set-cookie'];
    const pkce = cookies.find((c) => c.startsWith('pkce_verifier='));
    expect(pkce).toMatch(/HttpOnly/i);

    const target = new URL(res.headers.location);
    expect(target.origin).toBe('https://secure.soundcloud.com');
    expect(target.searchParams.get('code_challenge_method')).toBe('S256');
    expect(target.searchParams.get('code_challenge')).toBeTruthy();
    // the challenge is a hash, never the verifier itself
    const verifier = decodeURIComponent(pkce.split(';')[0].slice('pkce_verifier='.length));
    expect(target.searchParams.get('code_challenge')).not.toBe(verifier);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- tests/routes/auth-callback.test.js`
Expected: PASS (these document existing correct behavior). If the happy-path session assertion fails because `logOperation` is imported differently than mocked, fix the mock's shape to match `server/lib/analytics.js`'s real exports — run `grep -n "^export" server/lib/analytics.js` and mirror them.

- [ ] **Step 3: Run the full suite** — `npm test` — Expected: 27 suites green.

- [ ] **Step 4: Commit**

```bash
git add tests/routes/auth-callback.test.js
git commit -m "test(auth): OAuth callback and PKCE login route coverage"
```

---

### Task 2: `assertFollowedUser` authorization test (review §5 P0 #2, second half)

**Files:**
- Test: `tests/routes/followed-library-authz.test.js`

**Interfaces:**
- Consumes: `api` router default export from `server/routes/api.js`; `soundcloudClient` from `server/lib/soundcloud-client.js`; `authenticateUser` from `server/middleware/auth.js`.
- Produces: nothing consumed by later tasks.

**Why this one matters:** the review calls this the test that "directly answers the external reviewer" — it proves a user cannot browse the library of somebody they do not follow. `assertFollowedUser` (`server/routes/api.js:160-169`) throws a 403-tagged error when the target is absent from the caller's followings.

- [ ] **Step 1: Write the test file**

Create `tests/routes/followed-library-authz.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

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
```

- [ ] **Step 2: Run it**

Run: `npm test -- tests/routes/followed-library-authz.test.js`
Expected: PASS. If `api.js` fails to import because a transitively-imported module needs an env var, add that env var at the top of the test file (before the dynamic import) exactly as `tests/soundcloud-client-timeout.test.js` does with `ENCRYPTION_KEY`.

- [ ] **Step 3: Run the full suite** — `npm test` — Expected: 28 suites green.

- [ ] **Step 4: Commit**

```bash
git add tests/routes/followed-library-authz.test.js
git commit -m "test(authz): assertFollowedUser gates all three followed-library pages before any fetch"
```

---

### Task 3: CSRF fail-closed on the mutating routes the review named (review §5 P1 #5)

**Files:**
- Test: `tests/routes/csrf-fail-closed.test.js`

**Interfaces:**
- Consumes: `api` router default export from `server/routes/api.js`; `rejectUntrustedOrigin` from `server/middleware/security.js`.
- Produces: nothing consumed by later tasks.

**Why:** PR #29 locked the invariant in on `/feedback/survey` only. The review named bulk-unlike and merge — the two highest-blast-radius mutations. This test covers both layers on both routes.

- [ ] **Step 1: Write the test file**

Create `tests/routes/csrf-fail-closed.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'development'; // disables rate limiters
process.env.APP_URLS = 'https://www.soundcloudtoolkit.com';

const unlikeTrack = jest.fn().mockResolvedValue({});
const getPlaylistWithTracks = jest.fn().mockResolvedValue({ tracks: [] });

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { unlikeTrack, getPlaylistWithTracks },
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

// Mirrors server/index.js exactly: Origin check, then express.json() as the
// ONLY body parser. No express.urlencoded() — that absence is the invariant.
const app = express();
app.use('/api', rejectUntrustedOrigin);
app.use(express.json());
app.use('/api', apiRoutes);

beforeEach(() => { unlikeTrack.mockClear(); });

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
```

- [ ] **Step 2: Run it**

Run: `npm test -- tests/routes/csrf-fail-closed.test.js`
Expected: PASS. If the merge route's mocked client needs more methods (it calls `getPlaylistWithTracks` per source playlist), the 403/400 assertions still hold because the handler never runs — only the "legitimate path" test needs a complete mock, and that one uses bulk-unlike deliberately for exactly this reason.

- [ ] **Step 3: Run the full suite** — `npm test` — Expected: 29 suites green.

- [ ] **Step 4: Commit**

```bash
git add tests/routes/csrf-fail-closed.test.js
git commit -m "test(security): CSRF fail-closed on bulk-unlike and merge, both layers"
```

---

### Task 4: Token refresh through `authenticateUser` (review §5 P1 #6)

**Files:**
- Test: `tests/routes/token-refresh.test.js`

**Interfaces:**
- Consumes: `authenticateUser` from `server/middleware/auth.js`; `soundcloudClient` from `server/lib/soundcloud-client.js`; `runWithTokenContext`/`getTokenContext` from `server/lib/token-context.js`; `encrypt` from `server/lib/crypto.js`.
- Produces: nothing consumed by later tasks. **Task 5 depends on this test existing** — it is the regression net for the mutex change.

**What this proves end-to-end:** session cookie → `authenticateUser` decrypts tokens and establishes the AsyncLocalStorage token context → `scRequest` gets a 401 → refreshes → **persists the new tokens against the right `userId`** → retries → succeeds. The persistence step is the one that silently broke before `token-context.js` existed.

- [ ] **Step 1: Write the test file**

Create `tests/routes/token-refresh.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Response } from 'node-fetch';

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

beforeEach(() => {
  tokenUpdate.mockClear();
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
```

- [ ] **Step 2: Run it**

Run: `npm test -- tests/routes/token-refresh.test.js`
Expected: PASS. If the refresh POST body assertion order differs, adjust only the mock ordering — the token-exchange call is the 2nd `fetch` because `refreshTokens` posts to `secure.soundcloud.com/oauth/token`. Confirm with `grep -n "oauth/token" server/lib/soundcloud-client.js`.

- [ ] **Step 3: Run the full suite** — `npm test` — Expected: 30 suites green.

- [ ] **Step 4: Commit**

```bash
git add tests/routes/token-refresh.test.js
git commit -m "test(auth): token refresh persists under the session's token context and retries"
```

---

### Task 5: Concurrent-refresh mutex (review §7 — turns an UNSUPPORTED resume claim into a PROVEN one)

**Files:**
- Modify: `server/lib/soundcloud-client.js` (`refreshTokensAndPersist`, ~line 120)
- Test: `tests/soundcloud-client-refresh-mutex.test.js`

**Interfaces:**
- Consumes: `getTokenContext` from `server/lib/token-context.js` (already imported by the client).
- Produces: module-level `inFlightRefreshes` (a `Map<string, Promise>`, **not** exported) inside `soundcloud-client.js`. Public API of `refreshTokensAndPersist(refreshToken)` is unchanged — same signature, same return value.

**Why this is a real fix, not just a resume line:** `refreshTokensAndPersist` (`server/lib/soundcloud-client.js:120-147`) is re-entrant today. Two concurrent requests for the same user that both 401 will both call SoundCloud's token endpoint. SoundCloud rotates the refresh token on use, so the second exchange presents an already-consumed refresh token: it fails, and worse, whichever `prisma.token.update` lands last can persist the *older* pair — logging the user out. The review rated this LOW (single-threaded Node, rare dual-401) and scoped it out; §7 nonetheless lists the mutex as a claim. This task makes the claim true.

Keying is **per user**, not global: two different users refreshing simultaneously must not block each other. Requests with no token context (no `userId`) are not deduped — they cannot collide on a database row.

- [ ] **Step 1: Write the failing test**

Create `tests/soundcloud-client-refresh-mutex.test.js`:

```js
import { jest } from '@jest/globals';

process.env.ENCRYPTION_KEY = 'x'.repeat(32);

const tokenUpdate = jest.fn().mockResolvedValue({});
jest.unstable_mockModule('../server/lib/prisma.js', () => ({
  default: { token: { update: tokenUpdate } },
}));

const { soundcloudClient } = await import('../server/lib/soundcloud-client.js');
const { runWithTokenContext } = await import('../server/lib/token-context.js');

let resolveRefresh;
beforeEach(() => {
  tokenUpdate.mockClear();
  // One slow, controllable token exchange so overlap is deterministic.
  global.fetch = jest.fn(() => new Promise((resolve) => {
    resolveRefresh = () => resolve(new Response(
      JSON.stringify({ access_token: 'fresh-a', refresh_token: 'fresh-r', expires_in: 3600 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  }));
});

test('concurrent refreshes for the SAME user collapse into one token exchange', async () => {
  const both = runWithTokenContext({ userId: 'user-1' }, () =>
    Promise.all([
      soundcloudClient.refreshTokensAndPersist('rt'),
      soundcloudClient.refreshTokensAndPersist('rt'),
    ])
  );

  await Promise.resolve();
  resolveRefresh();
  const [first, second] = await both;

  // ONE network exchange, ONE database write — not two of each
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(tokenUpdate).toHaveBeenCalledTimes(1);
  // both callers get the same fresh tokens
  expect(first.access_token).toBe('fresh-a');
  expect(second.access_token).toBe('fresh-a');
});

test('a later refresh for the same user is NOT served from a stale in-flight entry', async () => {
  const firstRun = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt')
  );
  await Promise.resolve();
  resolveRefresh();
  await firstRun;

  const secondRun = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt')
  );
  await Promise.resolve();
  resolveRefresh();
  await secondRun;

  // the map must be cleared on settle, so the second call exchanges again
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('different users refresh independently and are not serialized together', async () => {
  const a = runWithTokenContext({ userId: 'user-1' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt-a')
  );
  const resolveA = resolveRefresh;
  const b = runWithTokenContext({ userId: 'user-2' }, () =>
    soundcloudClient.refreshTokensAndPersist('rt-b')
  );
  const resolveB = resolveRefresh;

  resolveA();
  resolveB();
  await Promise.all([a, b]);

  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(tokenUpdate).toHaveBeenCalledTimes(2);
  const userIds = tokenUpdate.mock.calls.map((c) => c[0].where.userId).sort();
  expect(userIds).toEqual(['user-1', 'user-2']);
});

test('a rejected refresh clears the in-flight entry so the next attempt retries', async () => {
  global.fetch = jest.fn(() => Promise.resolve(new Response('', { status: 400 })));

  await expect(
    runWithTokenContext({ userId: 'user-1' }, () =>
      soundcloudClient.refreshTokensAndPersist('rt')
    )
  ).rejects.toThrow();

  await expect(
    runWithTokenContext({ userId: 'user-1' }, () =>
      soundcloudClient.refreshTokensAndPersist('rt')
    )
  ).rejects.toThrow();

  // second attempt actually hit the network — the failed promise was not cached
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/soundcloud-client-refresh-mutex.test.js`
Expected: FAIL on the first test — `fetch` is called **2** times and `tokenUpdate` **2** times, because `refreshTokensAndPersist` has no dedupe today.

- [ ] **Step 3: Implement the mutex**

In `server/lib/soundcloud-client.js`, add above the class definition (next to `fetchWithTimeout`):

```js
/**
 * In-flight token refreshes, keyed by userId. SoundCloud rotates the refresh
 * token on every exchange, so two concurrent 401s for the same user would
 * present the same refresh token twice: the second exchange fails, and the
 * losing prisma.token.update can persist the older pair and log the user out.
 * Collapsing them onto one promise makes the refresh idempotent per user.
 *
 * Per-process, like the resolve cache and the growth job registry — it matches
 * the single-instance deploy. A second backend instance would each hold their
 * own map; the DB write is still last-writer-wins across instances.
 */
const inFlightRefreshes = new Map();
```

Then replace the body of `refreshTokensAndPersist` (currently lines ~120-147) with a wrapper that keeps the existing logic verbatim inside a private method:

```js
  async refreshTokensAndPersist(refreshToken) {
    const context = getTokenContext();
    const userId = context?.userId;

    // No user context => nothing to collide on (and nothing to persist).
    if (!userId) return this._refreshAndPersistNow(refreshToken, null);

    const existing = inFlightRefreshes.get(userId);
    if (existing) return existing;

    const pending = this._refreshAndPersistNow(refreshToken, userId)
      .finally(() => {
        // Always clear, on success AND failure, so a failed refresh does not
        // poison every later attempt for this user.
        inFlightRefreshes.delete(userId);
      });
    inFlightRefreshes.set(userId, pending);
    return pending;
  }

  /** The original, un-deduplicated refresh+persist. Do not call directly. */
  async _refreshAndPersistNow(refreshToken, userId) {
    const newTokens = await this.refreshTokens(refreshToken);

    if (!userId) {
      logger.warn('Token refresh completed without user context; refreshed tokens were not persisted', {
        hasAccessToken: Boolean(newTokens.access_token),
        hasRefreshToken: Boolean(newTokens.refresh_token),
        expiresIn: newTokens.expires_in,
      });
      return newTokens;
    }

    if (newTokens.access_token && newTokens.refresh_token) {
      const expiresAt = new Date(Date.now() + ((newTokens.expires_in || 3600) * 1000));
      await prisma.token.update({
        where: { userId },
        data: {
          encrypted: encrypt(newTokens.access_token, this.encryptionKey),
          refresh: encrypt(newTokens.refresh_token, this.encryptionKey),
          expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    return newTokens;
  }
```

Note two deliberate changes while moving the code: the `userId` now comes from the caller instead of a second `getTokenContext()` call (the context is not guaranteed to survive into the deduped promise's continuation), and the stray `console.warn` becomes `logger.warn` so the sanitizer covers it. Both are behavior-preserving.

- [ ] **Step 4: Run the mutex test** — `npm test -- tests/soundcloud-client-refresh-mutex.test.js` — Expected: PASS, all 4.

- [ ] **Step 5: Run the full suite** — `npm test` — Expected: 31 suites green. **`tests/routes/token-refresh.test.js` from Task 4 must still pass** — it is the proof the mutex did not break the normal single-refresh path.

- [ ] **Step 6: Commit**

```bash
git add server/lib/soundcloud-client.js tests/soundcloud-client-refresh-mutex.test.js
git commit -m "fix(client): dedupe concurrent token refreshes per user so rotation cannot clobber the stored pair"
```

---

### Task 6: Remaining P2 tests — rate-limiter config, growth cooldown, bulk-op partial failure

**Files:**
- Test: `tests/rate-limiter-config.test.js`
- Test: `tests/routes/growth-limits.test.js`
- Test: `tests/routes/bulk-partial-failure.test.js`

**Interfaces:**
- Consumes: the four limiters from `server/middleware/rateLimiter.js`; `growth` router default export from `server/routes/growth.js`; `getGrowthBudget`, `GROWTH_DAILY_FOLLOW_CAP`, `GROWTH_SESSION_COOLDOWN_MS` from `server/lib/growth-engine.js`; `api` router from `server/routes/api.js`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rate-limiter config assertions**

Create `tests/rate-limiter-config.test.js`:

```js
import { jest } from '@jest/globals';

// Production mode, or createLimiter() returns bare pass-throughs.
process.env.NODE_ENV = 'production';

const rateLimit = jest.fn((options) => {
  const mw = (req, res, next) => next();
  mw.options = options;
  return mw;
});
jest.unstable_mockModule('express-rate-limit', () => ({ default: rateLimit }));

const limiters = await import('../server/middleware/rateLimiter.js');

const MINUTE = 60 * 1000;

describe('rate limiter tiers are configured as documented', () => {
  test('general API: 100 requests / 15 minutes', () => {
    expect(limiters.apiRateLimiter.options).toMatchObject({
      windowMs: 15 * MINUTE, max: 100, standardHeaders: true, legacyHeaders: false,
    });
  });

  test('auth: 5 attempts / 15 minutes, successful requests not counted', () => {
    expect(limiters.authRateLimiter.options).toMatchObject({
      windowMs: 15 * MINUTE, max: 5, skipSuccessfulRequests: true,
    });
  });

  test('heavy operations: 20 / hour', () => {
    expect(limiters.heavyOperationRateLimiter.options).toMatchObject({
      windowMs: 60 * MINUTE, max: 20,
    });
  });

  test('health check: 60 / minute', () => {
    expect(limiters.healthCheckRateLimiter.options).toMatchObject({
      windowMs: MINUTE, max: 60,
    });
  });

  test('every limiter is strictly stricter than the tier above it where it matters', () => {
    expect(limiters.authRateLimiter.options.max)
      .toBeLessThan(limiters.apiRateLimiter.options.max);
    expect(limiters.heavyOperationRateLimiter.options.max)
      .toBeLessThan(limiters.apiRateLimiter.options.max);
  });

  test('no limiter defines a custom keyGenerator (default handles IPv6 correctly)', () => {
    for (const name of ['apiRateLimiter', 'authRateLimiter', 'heavyOperationRateLimiter', 'healthCheckRateLimiter']) {
      expect(limiters[name].options.keyGenerator).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it** — `npm test -- tests/rate-limiter-config.test.js` — Expected: PASS.

- [ ] **Step 3: Growth cooldown enforced at the route layer**

Create `tests/routes/growth-limits.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'development'; // disables rate limiters

const findMany = jest.fn();
const startEngagementJob = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { growthAction: { findMany, count: jest.fn().mockResolvedValue(0) } },
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 'user-a', soundcloudId: 111 };
    req.accessToken = 'at';
    req.refreshToken = 'rt';
    next();
  },
}));

const { default: growthRoutes } = await import('../../server/routes/growth.js');
const { GROWTH_DAILY_FOLLOW_CAP, GROWTH_SESSION_COOLDOWN_MS } =
  await import('../../server/lib/growth-engine.js');

const app = express();
app.use(express.json());
app.use('/api', growthRoutes);

function targets(n) {
  return Array.from({ length: n }, (_, i) => ({ userId: 1000 + i }));
}

beforeEach(() => { findMany.mockReset(); startEngagementJob.mockClear(); });

describe('follow caps are enforced server-side regardless of what the client asks for', () => {
  test('a user at the daily cap is refused with 429', async () => {
    // every follow in the last 24h, none older
    findMany.mockResolvedValue(
      Array.from({ length: GROWTH_DAILY_FOLLOW_CAP }, () => ({
        createdAt: new Date(Date.now() - 60 * 1000), action: 'follow',
      }))
    );

    const res = await request(app).post('/api/growth/engage').send({ targets: targets(1) });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/daily follow limit/i);
  });

  test('a user inside the session cooldown is refused with 429', async () => {
    findMany.mockResolvedValue([
      { createdAt: new Date(Date.now() - (GROWTH_SESSION_COOLDOWN_MS / 2)), action: 'follow' },
    ]);

    const res = await request(app).post('/api/growth/engage').send({ targets: targets(1) });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/cooldown/i);
  });

  test('requesting more targets than the remaining budget is refused with 400', async () => {
    findMany.mockResolvedValue(
      Array.from({ length: GROWTH_DAILY_FOLLOW_CAP - 2 }, () => ({
        createdAt: new Date(Date.now() - GROWTH_SESSION_COOLDOWN_MS - 60 * 1000),
        action: 'follow',
      }))
    );

    const res = await request(app).post('/api/growth/engage').send({ targets: targets(10) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/remaining in your daily budget/i);
  });

  test('GET /growth/limits reports the cap without mutating anything', async () => {
    findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/growth/limits');
    expect(res.status).toBe(200);
    expect(res.body.budget ?? res.body).toMatchObject({ dailyCap: GROWTH_DAILY_FOLLOW_CAP });
  });
});
```

**If `getGrowthBudget` queries Prisma differently than `findMany`** (check with `sed -n '42,70p' server/lib/growth-engine.js`), adapt the mock to whatever it actually calls — `count`, `aggregate`, or `findFirst` — keeping the assertions identical. The assertions are the contract; the mock shape is an implementation detail.

- [ ] **Step 4: Run it** — `npm test -- tests/routes/growth-limits.test.js` — Expected: PASS.

- [ ] **Step 5: Bulk-op partial-failure logging regression**

This cements the ANALYSIS.md "bulk-like silent success" fix (already shipped in cc416ad). Create `tests/routes/bulk-partial-failure.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'development';

const likeTrack = jest.fn();
const logOperation = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));
jest.unstable_mockModule('../../server/lib/soundcloud-client.js', () => ({
  soundcloudClient: { likeTrack },
}));
jest.unstable_mockModule('../../server/lib/analytics.js', () => ({
  logOperation,
  startOperationTimer: () => () => 42,
  extractClientInfo: () => ({}),
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

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const bulkLikeCall = () => logOperation.mock.calls.map((c) => c[0]).find((a) => a.action === 'bulk-like');

beforeEach(() => { likeTrack.mockReset(); logOperation.mockClear(); });

describe('bulk-like reports per-item outcomes instead of silently succeeding', () => {
  test('a partial failure is visible in the response AND in the operation log', async () => {
    likeTrack
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('403 Forbidden'))
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/likes/tracks/bulk-like')
      .send({ trackIds: [1, 2, 3] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { trackId: 1, status: 'ok' },
      { trackId: 2, status: 'error', error: '403 Forbidden' },
      { trackId: 3, status: 'ok' },
    ]);

    const logged = bulkLikeCall();
    expect(logged.metadata).toEqual({ total: 3, succeeded: 2, failed: 1 });
    // only the tracks that actually landed are recorded as liked
    expect(logged.trackIds).toEqual([1, 3]);
    expect(logged.trackCount).toBe(2);
  });

  test('an all-items-failed run is logged as an error, not a success', async () => {
    likeTrack.mockRejectedValue(new Error('429 Too Many Requests'));

    const res = await request(app)
      .post('/api/likes/tracks/bulk-like')
      .send({ trackIds: [1, 2] });

    expect(res.status).toBe(200);
    const logged = bulkLikeCall();
    expect(logged.status).toBe('error');
    expect(logged.errorCode).toBe('ALL_ITEMS_FAILED');
    expect(logged.trackCount).toBe(0);
    expect(logged.metadata).toEqual({ total: 2, succeeded: 0, failed: 2 });
  });

  test('a fully successful run is logged as success with every track recorded', async () => {
    likeTrack.mockResolvedValue({});

    await request(app).post('/api/likes/tracks/bulk-like').send({ trackIds: [1, 2] });

    const logged = bulkLikeCall();
    expect(logged.status).toBe('success');
    expect(logged.errorCode).toBeUndefined();
    expect(logged.metadata).toEqual({ total: 2, succeeded: 2, failed: 0 });
  });
});
```

Note: this route sleeps 150ms between writes, so a 3-item test takes ~450ms. That is fine; do not add fake timers.

- [ ] **Step 6: Run it** — `npm test -- tests/routes/bulk-partial-failure.test.js` — Expected: PASS.

- [ ] **Step 7: Run the full suite** — `npm test` — Expected: 34 suites green.

- [ ] **Step 8: Commit**

```bash
git add tests/rate-limiter-config.test.js tests/routes/growth-limits.test.js tests/routes/bulk-partial-failure.test.js
git commit -m "test: rate-limiter tiers, server-enforced growth caps, and bulk-op partial-failure logging"
```

---

### Task 7: Phase 4 measurement — logger overhead benchmark

**Files:**
- Create: `scripts/bench-logger.js`
- Modify: `docs/engineering-review-2026-08-25.md` (append a "Phase 4 Results" section)

**Interfaces:**
- Consumes: `logger` default export from `server/lib/logger.js`; `preventKeyLeakage` from `server/middleware/security.js`.
- Produces: `scripts/bench-logger.js`, runnable as `node scripts/bench-logger.js`. No new dependency — uses `node:perf_hooks`.

**The decision this informs (and the only reason to run it):** §8 Phase 4 says measure "only where it changes a decision." The decision is whether `preventKeyLeakage`'s response re-serialization stays as-is. If per-response overhead is under ~1ms it stays, unexamined, forever. If it is materially worse, it becomes a follow-up issue. Nothing else gets benchmarked.

- [ ] **Step 1: Write the benchmark**

Create `scripts/bench-logger.js`:

```js
/**
 * Phase 4 measurement (docs/engineering-review-2026-08-25.md §8).
 * Answers one question: is preventKeyLeakage's response re-serialization, plus
 * logger sanitization, cheap enough to leave alone? Run: node scripts/bench-logger.js
 * Not part of the test suite and not a dependency of anything.
 */
import { performance } from 'node:perf_hooks';

process.env.NODE_ENV = 'production';
const { default: logger } = await import('../server/lib/logger.js');
const { preventKeyLeakage } = await import('../server/middleware/security.js');

const ITERATIONS = 20_000;

function bench(label, fn) {
  fn(); // warm up JIT
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) fn();
  const totalMs = performance.now() - start;
  const perOpUs = (totalMs / ITERATIONS) * 1000;
  console.log(`${label.padEnd(46)} ${perOpUs.toFixed(2)} µs/op   (${totalMs.toFixed(0)} ms total)`);
  return perOpUs;
}

// Silence output so we measure the work, not the terminal.
const noop = () => {};
const realLog = console.log;
const realWarn = console.warn;
const realError = console.error;

const SHORT = '200 GET /api/playlists 154ms';
const WITH_SECRET =
  'resolve failed for https://api.soundcloud.com/me?oauth_token=abc123def456 token=zzz retrying';
const PAYLOAD = {
  collection: Array.from({ length: 50 }, (_, i) => ({
    id: i, title: `Track ${i}`, user: { id: i, username: `dj${i}` },
    artwork_url: `https://cdn/${i}.jpg`, duration: 210000,
  })),
  total: 50,
};

console.log(`\nlogger + preventKeyLeakage overhead — ${ITERATIONS.toLocaleString()} iterations each\n`);

console.log = noop; console.warn = noop; console.error = noop;
const clean = bench('logger.info, clean message', () => logger.info(SHORT));
const dirty = bench('logger.info, message containing secrets', () => logger.info(WITH_SECRET));
const withData = bench('logger.info, message + 50-item payload', () => logger.info(SHORT, PAYLOAD));

// preventKeyLeakage wraps res.json; measure one wrapped response cycle.
const middlewareCost = bench('preventKeyLeakage on a 50-track response', () => {
  const res = { json: (b) => b, locals: {} };
  preventKeyLeakage({ path: '/api/playlists' }, res, noop);
  res.json(PAYLOAD);
});
console.log = realLog; console.warn = realWarn; console.error = realError;

const perRequestMs = (clean + middlewareCost) / 1000;
console.log(`\nTypical per-request cost (1 info log + 1 wrapped response): ${perRequestMs.toFixed(3)} ms`);
console.log(
  perRequestMs < 1
    ? 'VERDICT: negligible (<1ms) — keep preventKeyLeakage as-is, no follow-up needed.\n'
    : 'VERDICT: material (>=1ms) — open a follow-up issue to narrow or cache the re-serialization.\n'
);
```

- [ ] **Step 2: Run it**

Run: `node scripts/bench-logger.js`
Expected: a table of four µs/op figures plus a verdict line. If `preventKeyLeakage` needs a fuller `res` object than the stub provides, read `server/middleware/security.js` and extend the stub with exactly the properties it touches — do not change the middleware.

- [ ] **Step 3: Record the result in the review doc**

Append to `docs/engineering-review-2026-08-25.md` (at the very end of the file), filling in the REAL numbers printed in Step 2 — do not copy the placeholders:

```markdown

---

## Phase 4 Results (measured 2026-08-25)

Benchmark: `scripts/bench-logger.js`, 20,000 iterations per case, Node
production mode, output suppressed.

| Case | µs/op |
|---|---|
| `logger.info`, clean message | _fill in_ |
| `logger.info`, message containing secrets | _fill in_ |
| `logger.info`, message + 50-item payload | _fill in_ |
| `preventKeyLeakage` on a 50-track response | _fill in_ |

**Typical per-request cost:** _fill in_ ms.

**Decision:** _keep `preventKeyLeakage` as-is / open a follow-up_ — state which,
and why the number supports it.

**Merge throughput** (the other Phase 4 candidate) is NOT measured here: it
requires a production `operation_log` export, which is a Cole action, not a
repo action. See "What I Need From Cole" in
`docs/superpowers/plans/2026-08-25-audit-completion.md`.
```

- [ ] **Step 4: Verify nothing else changed** — `npm test` — Expected: 34 suites green (the script is not in `tests/`, so the count is unchanged).

- [ ] **Step 5: Commit**

```bash
git add scripts/bench-logger.js docs/engineering-review-2026-08-25.md
git commit -m "perf: measure logger and preventKeyLeakage overhead, record the Phase 4 decision"
```

---

### Task 8: Phase 5 portfolio sweep

**Files:**
- Modify: `README.md`
- Modify: `docs/privacy-policy-draft-2026-08.md` (header only — **conditional, see Step 3**)

**Interfaces:** none (docs only).

- [ ] **Step 1: Link SECURITY.md from the README**

§8 Phase 5 wants the README top section to link both ANALYSIS.md and SECURITY.md; PR #29 added only the ANALYSIS.md link. In `README.md`, the "How it works" section's security bullet currently ends with "...every SoundCloud call is made server-side with the user's decrypted token." Append to that bullet:

```markdown
  The threat model, CSRF layering, and session-lifetime limitations are written
  up in [docs/SECURITY.md](docs/SECURITY.md).
```

- [ ] **Step 2: Sweep for TODO/debug remnants**

```bash
grep -rn "TODO\|FIXME\|XXX\|HACK" server/ frontend-UI/src/ scripts/ | grep -v node_modules
grep -rn "console\.log(" server/ | grep -v node_modules
```
Expected: the first returns nothing. The second may return legitimate CLI output in `scripts/bench-logger.js` only — that is fine. **Any `console.log` inside `server/lib/` or `server/routes/` is a finding**: replace it with the appropriate `logger.*` call (the logger sanitizes; bare `console.log` does not) and note it in the commit body. If either grep surfaces something you cannot resolve cleanly, stop and report rather than guessing.

- [ ] **Step 3: Resolve the privacy-policy draft — CONDITIONAL, do not guess**

`docs/privacy-policy-draft-2026-08.md` declares itself "DRAFT — NOT PUBLISHED" and is explicitly gated on two things: the operation-analytics branch shipping, and the SoundCloud API terms questions in `TERMS-CHECK.md` being resolved. The review says "archive if the live page supersedes it."

Determine whether the live page already covers the draft:

```bash
grep -n "beta\|email\|analytics\|operation" frontend-UI/src/app/privacy/page.tsx
```

- **If the live page already discloses beta-email collection and product analytics** (STATE.md's 2026-07-09 entry says it does): the draft is superseded. Add this line directly under the existing `> **DRAFT — NOT PUBLISHED.**` blockquote and change nothing else:
  ```markdown
  > **SUPERSEDED 2026-08-25** — the live privacy page now covers beta-email
  > collection and product-usage analytics. Kept for history; do not edit.
  ```
- **If it does not**, leave the file completely untouched and report that the draft is still live work, not an archivable artifact.

Either way, do NOT delete the file — `TERMS-CHECK.md` still references its open questions.

- [ ] **Step 4: Full verification**

```bash
npm test                                    # 34 suites green
cd frontend-UI && npm run build && cd ..    # clean static export
git log --oneline engineering-review-remediation..HEAD   # 8 commits from this plan
```

- [ ] **Step 5: Commit**

```bash
git add README.md docs/privacy-policy-draft-2026-08.md
git commit -m "docs: link SECURITY.md from the README and resolve the superseded privacy draft"
```

---

### Task 9: Ship

**Files:** none (process only).

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin audit-completion
```

Open a PR targeting **`engineering-review-remediation`** (not `main`) so it stacks cleanly on PR #29, unless #29 has already merged — in that case retarget to `main` and rebase first. Summarize: 8 new test suites closing every §5 gap, the concurrent-refresh mutex (one production behavior change, described below), the Phase 4 measurement result, and the Phase 5 sweep.

Flag in the PR body: **the mutex is the only production change.** It collapses concurrent same-user token refreshes onto one exchange. Low risk, covered by Tasks 4 and 5, but it touches the auth hot path — worth a careful read.

- [ ] **Step 2: After Cole merges and both platforms deploy**

Run the `/verify-deploy` skill against the live site. Minimum evidence:
1. Landing shows "Trusted by 3,500+ SoundCloud users" (PR #29's copy change).
2. A full login round-trip works — **every existing user is logged out once** by PR #29's session `iat` change; confirm re-login succeeds and lands on `/dashboard`.
3. One authenticated call returns real data (load `/dashboard` and confirm the summary populates).
4. A `/growth/limits` call still resolves — proves the extracted `routes/growth.js` is mounted correctly in production.

- [ ] **Step 3: Refresh STATE.md**

Run the `/handoff` skill. Move PR #29 and this PR out of "Now", record the deploy verification, and append any new decisions (the mutex's per-process/single-instance assumption belongs in Landmines alongside the resolve cache and growth job registry).

---

## What I Need From Cole

**Blocking — Task 6 cannot be fully verified without it:**

Nothing. Task 6 was written against the real `growth-engine.js` constants and adapts its mock shape at execution time.

**Blocking — one item outside the repo entirely:**

1. **A fresh production `operation_log` export.** This is the only thing in the audit I genuinely cannot do. It unblocks two review items:
   - §7 wants `ANALYSIS.md` refreshed so the resume claim stays repo-verifiable. It currently holds the **Aug 8** export (3,155 users / 1,125,105 tracks) while `README.md` now quotes **Aug 25** figures (3,570 / 2,032,233) *and cites ANALYSIS.md for methodology*. Those two documents currently disagree.
   - §7 flags the "400K+ tracks/month" resume claim as **EXTERNAL — verify before claiming**. The ~900K delta over ~17 days supports it *if* both figures came from the same query. Confirming that needs the export.
   - What I need: the same query ANALYSIS.md documents, re-run, with the date stamped. Then I rewrite ANALYSIS.md's figures and add a dated methodology note.

**Decisions, not blockers — I'll proceed with the stated default if you don't answer:**

2. **The concurrent-refresh mutex (Task 5) — build it or drop the claim?** The review rates the underlying race LOW and scoped it out of Phase 1, yet §7 lists the mutex as a resume claim that Phase 1 would make PROVEN. Those contradict. *Default: build it* — it's ~30 lines, well-tested, and fixes a real (if rare) way to log a user out. Say the word and I'll instead drop the mutex from the resume bullet list and leave the code alone.

3. **The privacy-policy draft (Task 8 Step 3).** I'll mark it SUPERSEDED only if the live page genuinely covers beta-email collection and analytics — otherwise I leave it alone and tell you. If you already know the live page is behind, say so and I'll skip the check. Either way I won't delete it; `TERMS-CHECK.md` still points at its open questions.

4. **PR target.** I'll stack this on `engineering-review-remediation` (PR #29). If you'd rather merge #29 first and have this go straight to `main`, tell me and I'll rebase.

---

## Self-Review Notes

- **Spec coverage.** §5 P0 #1 ✅ (PR #29) · P0 #2 first half ✅ (PR #29), second half → Task 2 · P0 #3 → Task 1 · P0 #4 ✅ (PR #29). P1 #5 ✅ partially (PR #29, survey route) → widened to bulk-unlike + merge in Task 3 · P1 #6 → Task 4 · P1 #7 ✅ (PR #29) · P1 #8 ✅ (PR #29). All P2 → Task 6 (resolve-cache eviction already done in PR #29). §6 ✅ (PR #29) except the SECURITY.md link and privacy draft → Task 8. §7's "concurrent-refresh mutex" → Task 5; §7's ANALYSIS.md refresh → blocked on Cole, documented above. §8 Phase 4 → Task 7 (logger half; merge-throughput half blocked on the export). §8 Phase 5 → Task 8. `/verify-deploy` + `/handoff` → Task 9. **Zero deferrals remain inside the repo's control.**
- **Known judgment points for the executor:** Task 6 Step 3 (mock shape must match `getGrowthBudget`'s real Prisma calls — assertions are the contract, mock is not) and Task 8 Step 3 (privacy draft is conditional with an explicit stop-and-report branch). Task 1 already encodes one review-vs-reality mismatch (302 redirect, not 400); watch for others and assert reality.
- **Type/name consistency:** `refreshTokensAndPersist(refreshToken)` keeps its exact signature across Tasks 4 and 5; the new private method is `_refreshAndPersistNow(refreshToken, userId)` in both the implementation and the prose. `inFlightRefreshes` is named identically in the doc comment, the implementation, and Task 5's rationale. Growth constants are `GROWTH_DAILY_FOLLOW_CAP` / `GROWTH_SESSION_COOLDOWN_MS`, matching `server/lib/growth-engine.js:34-35` verbatim.
- **Suite count math:** 26 entering → Task 1 (+1) 27 → Task 2 (+1) 28 → Task 3 (+1) 29 → Task 4 (+1) 30 → Task 5 (+1) 31 → Task 6 (+3) 34 → Tasks 7–9 (+0) **34**.
