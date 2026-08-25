# Engineering Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo showcase-ready for senior-engineer review: add route-level authz regression tests, close four security-hygiene gaps, remove dead code, perform the smallest useful `api.js` extractions, and make all docs and public claims accurate.

**Architecture:** No new layers. Security fixes land inside the existing modules (`server/lib/session.js`, `server/lib/logger.js`, `server/lib/soundcloud-client.js`, `server/middleware/security.js`). New route-level tests use supertest against mini Express apps that mount the real routers with `jest.unstable_mockModule` for `prisma`/auth. Refactors are mechanical moves into small `server/lib/` modules matching existing conventions.

**Tech Stack:** Node ESM (`"type": "module"`), Express 4, Prisma 5, Jest 29 (with `NODE_OPTIONS=--experimental-vm-modules`, already set by `npm test`), supertest (new devDependency).

**Spec:** `docs/engineering-review-2026-08-25.md` (the full engineering review — read §3 Critical Findings and §9 Commit Plan before starting).

## Global Constraints

- Work on a new branch off `main`: `git checkout -b engineering-review-remediation`.
- `npm test` (from repo root) must stay green after EVERY task. Baseline: 17 suites, 138 tests, ~2s.
- This is an ESM project. Jest mocking MUST use `jest.unstable_mockModule(...)` followed by dynamic `await import(...)` — `jest.mock()` does not work here. Top-level `await` works in test files.
- Do not touch anything listed under "Decisions" in `STATE.md` (landing headline "The Ultimate SoundCloud Toolkit", the 3 signature animations, color tokens, dashboard grouping, auth funnel naming).
- No new production dependencies. `supertest` is devDependency only.
- Commit after each task with the exact message given in the task. End every commit message with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- If any `@prisma/client` import fails in tests with "did you run prisma generate", run `npx prisma generate` once and retry.
- Pending inputs from Cole (do NOT block; handle as written in Tasks 13–14): LICENSE = MIT unless Cole objects; README provenance sentence — ask Cole, skip if unavailable; `/api/reposts/debug` — delete unless Cole says he still uses it.

---

### Task 1: Route-level test harness + authorization boundary tests

**Files:**
- Modify: `package.json` (add supertest devDependency)
- Test: `tests/routes/admin-auth.test.js`
- Test: `tests/routes/feedback-authz.test.js`

**Interfaces:**
- Consumes: `adminAuth` from `server/middleware/adminAuth.js` (signature `(req, res, next)`, reads `process.env.ADMIN_IDS`, 403s when unset or non-member); `feedback` router default export from `server/routes/feedback.js`; `admin` router default export from `server/routes/admin.js`; `prisma` **default** export from `server/lib/prisma.js`; `authenticateUser` named export from `server/middleware/auth.js`.
- Produces: `tests/routes/` directory pattern (mini-app + supertest + `unstable_mockModule`) that Tasks 2–3 reuse.

- [ ] **Step 1: Install supertest**

Run: `npm install --save-dev supertest`
Expected: `package.json` devDependencies gains `"supertest"`.

- [ ] **Step 2: Write the admin boundary test**

Create `tests/routes/admin-auth.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({ default: {} }));

const { adminAuth } = await import('../../server/middleware/adminAuth.js');
const { default: adminRoutes } = await import('../../server/routes/admin.js');

function appWithUser(user) {
  const app = express();
  app.get(
    '/admin-only',
    (req, res, next) => { req.user = user; next(); },
    adminAuth,
    (req, res) => res.json({ ok: true })
  );
  return app;
}

const ORIGINAL_ADMIN_IDS = process.env.ADMIN_IDS;
afterEach(() => {
  if (ORIGINAL_ADMIN_IDS === undefined) delete process.env.ADMIN_IDS;
  else process.env.ADMIN_IDS = ORIGINAL_ADMIN_IDS;
});

describe('adminAuth fails closed', () => {
  test('403 when ADMIN_IDS is unset', async () => {
    delete process.env.ADMIN_IDS;
    const res = await request(appWithUser({ soundcloudId: 111 })).get('/admin-only');
    expect(res.status).toBe(403);
  });

  test('403 for an authenticated non-admin', async () => {
    process.env.ADMIN_IDS = '999';
    const res = await request(appWithUser({ soundcloudId: 111 })).get('/admin-only');
    expect(res.status).toBe(403);
  });

  test('403 when req.user is missing entirely', async () => {
    process.env.ADMIN_IDS = '999';
    const res = await request(appWithUser(undefined)).get('/admin-only');
    expect(res.status).toBe(403);
  });

  test('200 for a configured admin', async () => {
    process.env.ADMIN_IDS = '111';
    const res = await request(appWithUser({ soundcloudId: 111 })).get('/admin-only');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('admin router registration', () => {
  test('every admin route runs authenticateUser and adminAuth', () => {
    const routes = adminRoutes.stack.filter((layer) => layer.route);
    expect(routes.length).toBeGreaterThan(0);
    for (const layer of routes) {
      const names = layer.route.stack.map((s) => s.handle.name);
      expect(names).toContain('authenticateUser');
      expect(names).toContain('adminAuth');
    }
  });
});
```

- [ ] **Step 3: Run it — expect PASS (these tests document existing correct behavior)**

Run: `npm test -- tests/routes/admin-auth.test.js`
Expected: PASS. If the router-registration test FAILS, that is a real finding — report which route lacks the middleware before proceeding.

- [ ] **Step 4: Write the feedback authz + CSRF fail-closed test**

Create `tests/routes/feedback-authz.test.js`:

```js
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const findUnique = jest.fn().mockResolvedValue(null);
const create = jest.fn();

jest.unstable_mockModule('../../server/lib/prisma.js', () => ({
  default: { betaSignup: { findUnique, create } },
}));
jest.unstable_mockModule('../../server/middleware/auth.js', () => ({
  authenticateUser: (req, res, next) => {
    req.user = { id: 'user-a', soundcloudId: 111 };
    next();
  },
}));

const { default: feedbackRoutes } = await import('../../server/routes/feedback.js');

const app = express();
app.use(express.json()); // mirrors prod: express.json() is the ONLY body parser
app.use('/api/feedback', feedbackRoutes);

beforeEach(() => { findUnique.mockClear(); create.mockClear(); });

describe('survey/status binds to the authenticated principal', () => {
  test('client-supplied userId/email in the query cannot select another user', async () => {
    const res = await request(app)
      .get('/api/feedback/survey/status?userId=user-b&email=victim@example.com');
    expect(res.status).toBe(200);
    expect(findUnique).toHaveBeenCalledTimes(1);
    const where = findUnique.mock.calls[0][0].where;
    // The lookup key comes from the session, never from the request
    expect(where.userId_campaignId.userId).toBe('user-a');
  });
});

describe('CSRF invariant: non-JSON bodies fail closed', () => {
  test('a cross-site form-encoded POST cannot submit the survey', async () => {
    const res = await request(app)
      .post('/api/feedback/survey')
      .type('form')
      .send('rekordboxUse=weekly&interest=high&wantsBeta=true');
    // express.json() ignores urlencoded bodies -> req.body empty -> validator rejects
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm test -- tests/routes/feedback-authz.test.js`
Expected: PASS (documents existing correct behavior). Then run the full suite: `npm test` — expect 19 suites green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/routes/
git commit -m "test: add route-level authz boundary tests (admin fail-closed, survey principal binding, CSRF fail-closed)"
```

---

### Task 2: Session hardening — timingSafeEqual + issued-at expiry

**Files:**
- Modify: `server/lib/session.js`
- Modify: `server/routes/auth.js:163-169` (sessionData object in the OAuth callback)
- Test: `tests/session.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SESSION_TTL_MS` named export from `server/lib/session.js` (number, 7 days in ms). `parseSessionData(json)` now returns `null` for payloads without a numeric `iat` or older than `SESSION_TTL_MS`. Callers (`server/middleware/auth.js`, `server/routes/auth.js` /me and /logout) need NO changes — they already treat `null` as invalid session.
- **Behavior change:** existing session cookies (no `iat`) become invalid on deploy → every user re-logs-in once. Note this in the PR description.

- [ ] **Step 1: Write the failing test**

Create `tests/session.test.js`:

```js
const SECRET = 'test-secret-that-is-at-least-32-chars!!';
const { signSession, unsignSession, parseSessionData, SESSION_TTL_MS } =
  await import('../server/lib/session.js');

describe('signSession / unsignSession', () => {
  test('round-trips a value containing dots', () => {
    const value = JSON.stringify({ userId: 'a.b.c', url: 'https://x.com/y' });
    expect(unsignSession(signSession(value, SECRET), SECRET)).toBe(value);
  });

  test('rejects a tampered signature', () => {
    const signed = signSession('payload', SECRET);
    const lastDot = signed.lastIndexOf('.');
    const tampered = signed.slice(0, lastDot + 1) + 'AAAA' + signed.slice(lastDot + 5);
    expect(unsignSession(tampered, SECRET)).toBeNull();
  });

  test('rejects a signature of the wrong length (timingSafeEqual guard)', () => {
    expect(unsignSession('payload.short', SECRET)).toBeNull();
  });
});

describe('parseSessionData expiry', () => {
  test('SESSION_TTL_MS is 7 days', () => {
    expect(SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('accepts a fresh payload with iat', () => {
    const json = JSON.stringify({ userId: 'u1', iat: Date.now() });
    expect(parseSessionData(json)).toMatchObject({ userId: 'u1' });
  });

  test('rejects a payload without iat (legacy cookie)', () => {
    expect(parseSessionData(JSON.stringify({ userId: 'u1' }))).toBeNull();
  });

  test('rejects a payload older than the TTL', () => {
    const json = JSON.stringify({ userId: 'u1', iat: Date.now() - SESSION_TTL_MS - 1000 });
    expect(parseSessionData(json)).toBeNull();
  });

  test('rejects malformed JSON', () => {
    expect(parseSessionData('not json')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/session.test.js`
Expected: FAIL — `SESSION_TTL_MS` is not exported; the "without iat" and "older than TTL" tests fail.

- [ ] **Step 3: Implement in `server/lib/session.js`**

Add near the top (after the import):

```js
/** Session lifetime. Also the cookie maxAge; enforced INSIDE the signed
 * payload via iat so a stolen cookie cannot outlive it. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
```

Replace the comparison in `unsignSession` (currently `if (signature !== expectedSignature) { return null; }`):

```js
  const providedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }
```

Replace `parseSessionData` entirely:

```js
export function parseSessionData(sessionJson) {
  try {
    const data = JSON.parse(sessionJson);
    if (!data || typeof data !== 'object') return null;
    // Sessions signed before iat existed (pre-hardening) are treated as
    // expired: users re-authenticate once after this deploys.
    if (typeof data.iat !== 'number' || Date.now() - data.iat > SESSION_TTL_MS) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
```

Change `createSessionCookieOptions` default param from `maxAge = 7 * 24 * 60 * 60 * 1000` to `maxAge = SESSION_TTL_MS`.

- [ ] **Step 4: Add `iat` at session creation**

In `server/routes/auth.js`, the callback's `sessionData` object (around line 163) becomes:

```js
    const sessionData = {
      userId: user.id,
      soundcloudId: user.soundcloudId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      iat: Date.now(),
    };
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all suites PASS (session tests now green; no other suite constructs session cookies).

- [ ] **Step 6: Commit**

```bash
git add server/lib/session.js server/routes/auth.js tests/session.test.js
git commit -m "fix(session): timing-safe HMAC comparison and enforced iat/TTL inside the signed payload"
```

---

### Task 3: Origin-check middleware (CSRF defense-in-depth)

**Files:**
- Modify: `server/middleware/security.js` (add two exports)
- Modify: `server/index.js:22` (import) and after line 104 (`app.use(cookieParser())`) — mount
- Test: `tests/routes/origin.test.js`

**Interfaces:**
- Consumes: env vars `APP_URLS` / `APP_URL` / `CHROME_EXTENSION_IDS` (same semantics as the CORS allowlist in `server/index.js:49-71`; parsed fresh per call like `adminAuth` does).
- Produces: `rejectUntrustedOrigin(req, res, next)` and `isTrustedOrigin(origin) -> boolean`, both named exports of `server/middleware/security.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/routes/origin.test.js`:

```js
import express from 'express';
import request from 'supertest';

const { rejectUntrustedOrigin } = await import('../../server/middleware/security.js');

const app = express();
app.use(rejectUntrustedOrigin);
app.post('/api/x', (req, res) => res.json({ ok: true }));
app.get('/api/x', (req, res) => res.json({ ok: true }));

const ORIGINAL = process.env.APP_URLS;
beforeEach(() => { process.env.APP_URLS = 'https://www.soundcloudtoolkit.com'; });
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.APP_URLS;
  else process.env.APP_URLS = ORIGINAL;
});

describe('rejectUntrustedOrigin', () => {
  test('allows state-changing requests with no Origin header (same-origin, curl)', async () => {
    expect((await request(app).post('/api/x')).status).toBe(200);
  });

  test('allows allowlisted origins', async () => {
    const res = await request(app).post('/api/x').set('Origin', 'https://www.soundcloudtoolkit.com');
    expect(res.status).toBe(200);
  });

  test('allows localhost origins (dev)', async () => {
    const res = await request(app).post('/api/x').set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(200);
  });

  test('rejects untrusted origins on POST with 403', async () => {
    const res = await request(app).post('/api/x').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
  });

  test('does not block GET requests regardless of Origin', async () => {
    const res = await request(app).get('/api/x').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/routes/origin.test.js`
Expected: FAIL — `rejectUntrustedOrigin` is not exported.

- [ ] **Step 3: Implement in `server/middleware/security.js`**

Append:

```js
/**
 * Is this Origin allowed to make credentialed state-changing requests?
 * Mirrors the CORS allowlist in server/index.js. Parsed fresh per call
 * (same pattern as adminAuth) so env changes apply without restart.
 */
export function isTrustedOrigin(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.hostname === 'localhost') return true;

  const allowed = (process.env.APP_URLS || process.env.APP_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.includes(origin)) return true;

  const allowedHostnames = allowed
    .map((o) => { try { return new URL(o).hostname; } catch { return null; } })
    .filter(Boolean);
  if (allowedHostnames.includes(url.hostname)) return true;

  const extensionOrigins = (process.env.CHROME_EXTENSION_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => `chrome-extension://${id}`);
  return extensionOrigins.includes(origin);
}

/**
 * CSRF defense-in-depth. Today CSRF is prevented "by accident": express.json()
 * is the only body parser, so a cross-site HTML form (urlencoded/text-plain,
 * no preflight) yields an empty req.body and every mutating route's validator
 * fails closed. That invariant is one express.urlencoded() away from breaking,
 * so this middleware makes the protection explicit: state-changing requests
 * bearing an untrusted Origin are rejected outright. Requests WITHOUT an
 * Origin header pass (same-origin navigations, curl, server-to-server).
 */
export function rejectUntrustedOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  if (isTrustedOrigin(origin)) return next();
  return res.status(403).json({ error: 'Origin not allowed' });
}
```

- [ ] **Step 4: Mount it in `server/index.js`**

Line 22 becomes:

```js
import { securityHeaders, preventKeyLeakage, validateEnv, rejectUntrustedOrigin } from './middleware/security.js';
```

Immediately after `app.use(cookieParser());` (line 104) add:

```js
// CSRF defense-in-depth: see rejectUntrustedOrigin doc comment.
app.use('/api', rejectUntrustedOrigin);
```

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/middleware/security.js server/index.js tests/routes/origin.test.js
git commit -m "fix(security): explicit Origin check on state-changing /api requests; document the CSRF invariant"
```

---

### Task 4: Fetch timeouts in the SoundCloud client

**Files:**
- Modify: `server/lib/soundcloud-client.js` (every `await fetch(` call site)
- Test: `tests/soundcloud-client-timeout.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: module-level `fetchWithTimeout(url, options?, timeoutMs?)` inside `soundcloud-client.js` (not exported); timeout default from `SC_FETCH_TIMEOUT_MS` env (default 30000). All SC API calls now reject with `AbortError` when the socket hangs past the deadline.

- [ ] **Step 1: Write the failing test**

Create `tests/soundcloud-client-timeout.test.js`:

```js
import { jest } from '@jest/globals';

process.env.SC_FETCH_TIMEOUT_MS = '50'; // must be set before the module loads
process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);

// fetch mock that never resolves but honors AbortController
global.fetch = jest.fn(
  (url, options = {}) =>
    new Promise((resolve, reject) => {
      if (options.signal) {
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      }
    })
);

const { soundcloudClient } = await import('../server/lib/soundcloud-client.js');

test('a hanging SoundCloud request aborts at the timeout instead of hanging forever', async () => {
  await expect(
    soundcloudClient.scRequest('/me', 'access', 'refresh')
  ).rejects.toThrow(/abort/i);
  // the fetch call actually received an abort signal
  expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
}, 5000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/soundcloud-client-timeout.test.js`
Expected: FAIL by Jest timeout (the promise never settles) or signal assertion failure.

- [ ] **Step 3: Implement**

In `server/lib/soundcloud-client.js`, add above the class definition:

```js
const SC_FETCH_TIMEOUT_MS = Number(process.env.SC_FETCH_TIMEOUT_MS) || 30_000;

/** fetch that cannot hang: aborts after timeoutMs. SoundCloud has no SLA on
 * slow sockets; without this a single stuck request holds the response open
 * indefinitely. */
async function fetchWithTimeout(url, options = {}, timeoutMs = SC_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

Then run `grep -n "await fetch(" server/lib/soundcloud-client.js` and replace EVERY occurrence with `await fetchWithTimeout(` (known sites: token exchange/refresh ~line 89, `scRequest` lines 141 and 157, `paginate` line 279, `resolveAny`/`resolvePublic` ~lines 383/394 — trust the grep, not this list).

- [ ] **Step 4: Run full suite**

Run: `npm test`
Expected: PASS, including the existing `soundcloud-client.test.js` (its fetch mocks ignore the extra `signal` option harmlessly). If any existing mock asserts exact fetch options, update that assertion to `expect.objectContaining`.

- [ ] **Step 5: Commit**

```bash
git add server/lib/soundcloud-client.js tests/soundcloud-client-timeout.test.js
git commit -m "fix(client): AbortController timeout on every SoundCloud fetch (default 30s, SC_FETCH_TIMEOUT_MS override)"
```

---

### Task 5: Logger hardening + fix pino-style logger calls

**Files:**
- Modify: `server/lib/logger.js` (sanitize message on info/debug; URL-token pattern)
- Modify: `server/routes/feedback.js:47,102,120` (argument order)
- Test: `tests/logger.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: unchanged logger API `logger.{error,warn,info,debug}(message, data?)` — now ALL levels sanitize the message string; `SECRET_PATTERNS` additionally matches secrets embedded in URL query strings.

- [ ] **Step 1: Write the failing test**

Create `tests/logger.test.js`:

```js
import { jest } from '@jest/globals';
const { default: logger } = await import('../server/lib/logger.js');

let logSpy;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });

describe('logger.info message sanitization', () => {
  test('redacts token= in the message string', () => {
    logger.info('refresh failed token=super-secret-value retrying');
    expect(logSpy.mock.calls[0][0]).toContain('token=***');
    expect(logSpy.mock.calls[0][0]).not.toContain('super-secret-value');
  });

  test('redacts oauth_token embedded in a URL query string', () => {
    logger.info('resolving https://api.soundcloud.com/me?oauth_token=SECRET123&limit=5');
    expect(logSpy.mock.calls[0][0]).not.toContain('SECRET123');
  });

  test('leaves ordinary messages untouched', () => {
    logger.info('200 GET /api/playlists 154ms');
    expect(logSpy.mock.calls[0][0]).toBe('[INFO] 200 GET /api/playlists 154ms');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/logger.test.js`
Expected: FAIL — `logger.info` currently logs the raw message (`server/lib/logger.js:182,184`).

- [ ] **Step 3: Implement in `server/lib/logger.js`**

Add one pattern to the END of `SECRET_PATTERNS` (the existing replacement callback `match.split(/[=:]/)[0]` already produces `?oauth_token=***` for it):

```js
  /[?&](oauth_token|access_token|refresh_token|client_secret|token|code|key|secret|password)=[^&\s"']+/gi,
```

In `info()` and `debug()`, sanitize the message exactly as `warn()` does — replace `${message}` with `${sanitizedMessage}` after adding `const sanitizedMessage = sanitizeString(String(message));` as the first line of each method.

- [ ] **Step 4: Fix argument order in `server/routes/feedback.js` (object-first pino style against our `(message, data)` logger)**

Line 47: `logger.error({ err: error.message }, 'survey status error');` → `logger.error('survey status error', safeError(error));`
Lines 102-109: `logger.info({ ... }, 'beta signup recorded');` → `logger.info('beta signup recorded', { userId: req.user.id, campaignId, rekordboxUse, interest, wantsBeta: wantsBeta === true, context });`
Line 120: `logger.error({ err: error.message }, 'survey submit error');` → `logger.error('survey submit error', safeError(error));`

- [ ] **Step 5: Run full suite** — `npm test` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/logger.js server/routes/feedback.js tests/logger.test.js
git commit -m "fix(logger): sanitize message strings on all levels, redact secrets in URL query strings, fix pino-style call sites"
```

---

### Task 6: Dead-code sweep

**Files:**
- Delete: `server/lib/session.ts`, `server/lib/pkce.ts`, `server/lib/crypto.ts`, `server/verify_sc_user.js`, `frontend-UI/src/components/MonetizationSurveyModal.tsx`
- Modify: `server/routes/api.js` (remove the `/reposts/debug` route — unless Cole says he still uses it)

**Interfaces:** none — this task must produce zero behavior change (except removing the debug endpoint).

- [ ] **Step 1: Prove the files are unreferenced**

```bash
git grep -n "session.ts\|pkce.ts\|crypto.ts\|verify_sc_user\|MonetizationSurveyModal"
grep -rn "reposts/debug" frontend-UI/src/
```
Expected: no imports of the `.ts` files or the modal outside their own files; no frontend caller of `/reposts/debug`. If ANY reference appears, stop and report instead of deleting that file.

- [ ] **Step 2: Delete**

```bash
git rm server/lib/session.ts server/lib/pkce.ts server/lib/crypto.ts server/verify_sc_user.js frontend-UI/src/components/MonetizationSurveyModal.tsx
```

- [ ] **Step 3: Remove the `/reposts/debug` route** — locate with `grep -n "reposts/debug" server/routes/api.js`, delete the whole `router.get('/reposts/debug', ...)` block including its doc comment. (Skip this step only if Cole has said to keep it.)

- [ ] **Step 4: Verify**

Run: `npm test` — PASS.
Run: `cd frontend-UI && npm run build && cd ..` — build succeeds (proves the modal was unreferenced).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dead code (unused .ts duplicates, debug script, unused survey modal, /reposts/debug endpoint)"
```

---

### Task 7: Shared pacing module

**Files:**
- Create: `server/lib/pacing.js`
- Modify: `server/routes/api.js` (7 inline `const sleep =` at lines 609, 1121, 1517, 1557, 1934, 2389, 3102), `server/lib/enrichment.js:20`, `server/lib/growth-scheduler.js:11`, `server/lib/growth-engine.js:3`, `server/lib/prisma.js:18`
- Test: `tests/pacing.test.js`

**Interfaces:**
- Produces: `export const sleep = (ms) => ...` and `export const SC_WRITE_PACING_MS = 300` from `server/lib/pacing.js`. Task 11 (growth extraction) imports `sleep` from here.

- [ ] **Step 1: Write the failing test**

Create `tests/pacing.test.js`:

```js
const { sleep, SC_WRITE_PACING_MS } = await import('../server/lib/pacing.js');

test('sleep resolves after roughly the requested delay', async () => {
  const start = Date.now();
  await sleep(20);
  expect(Date.now() - start).toBeGreaterThanOrEqual(15);
});

test('standard SoundCloud write pacing is 300ms', () => {
  expect(SC_WRITE_PACING_MS).toBe(300);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- tests/pacing.test.js` — FAIL (module missing).

- [ ] **Step 3: Create `server/lib/pacing.js`**

```js
/**
 * Pacing for sequential SoundCloud API writes. SoundCloud's rate limits are
 * undocumented; 300ms between mutating calls is the empirically safe floor
 * used across merge, clone, and bulk operations.
 */
export const SC_WRITE_PACING_MS = 300;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

- [ ] **Step 4: Replace the duplicates**

In `server/routes/api.js`: delete all 7 `const sleep = (ms) => ...` lines and add `import { sleep, SC_WRITE_PACING_MS } from '../lib/pacing.js';` to the import block. Where a call is literally `sleep(300)`, change it to `sleep(SC_WRITE_PACING_MS)`; leave other literals (150/500/etc.) unchanged — they are call-site-specific.
In `enrichment.js`, `growth-scheduler.js`, `growth-engine.js`, `prisma.js`: delete the local `const sleep = ...` line and add `import { sleep } from './pacing.js';`. (`pacing.js` has zero imports, so `prisma.js` importing it creates no cycle.)
Verify no stragglers: `grep -rn "const sleep" server/` → expect only `server/lib/pacing.js`.

- [ ] **Step 5: Run full suite** — `npm test` — PASS (growth-engine tests exercise its pacing indirectly).

- [ ] **Step 6: Commit**

```bash
git add server/lib/pacing.js server/routes/api.js server/lib/enrichment.js server/lib/growth-scheduler.js server/lib/growth-engine.js server/lib/prisma.js tests/pacing.test.js
git commit -m "refactor: single shared sleep + named SoundCloud write-pacing constant"
```

---

### Task 8: Extract resource normalizers to `server/lib/normalize.js`

**Files:**
- Create: `server/lib/normalize.js`
- Modify: `server/routes/api.js` (remove functions at lines ~140-151 and ~183-312, add import)
- Test: `tests/normalize.test.js`

**Interfaces:**
- Produces: named exports `extractNumericId`, `normalizeResource`, `normalizeResourceV2`, `normalizeTrackForLibraryBrowser`, `normalizePlaylistForLibraryBrowser` — function bodies MOVED VERBATIM from `api.js` (they are pure; `extractNumericId` moves too because all four normalizers call it).

- [ ] **Step 1: Write the failing test**

Create `tests/normalize.test.js`:

```js
const {
  extractNumericId,
  normalizeResource,
  normalizeTrackForLibraryBrowser,
  normalizePlaylistForLibraryBrowser,
} = await import('../server/lib/normalize.js');

describe('extractNumericId', () => {
  test('passes numbers through', () => expect(extractNumericId(42)).toBe(42));
  test('parses numeric strings', () => expect(extractNumericId('42')).toBe(42));
  test('parses SoundCloud URNs', () => expect(extractNumericId('soundcloud:tracks:123')).toBe(123));
  test('returns undefined for junk', () => expect(extractNumericId('abc')).toBeUndefined());
});

describe('normalizeResource', () => {
  test('normalizes a track', () => {
    const out = normalizeResource({
      kind: 'track', id: 5, title: 'T', duration: 1000,
      user: { id: 9, username: 'dj' }, permalink_url: 'https://soundcloud.com/dj/t',
    });
    expect(out).toMatchObject({ type: 'track', id: 5, title: 'T', duration_ms: 1000 });
    expect(out.user).toEqual({ id: 9, username: 'dj' });
  });
  test('falls back through wrapper objects', () => {
    const out = normalizeResource({ track: { id: 7, title: 'W', user: {} } });
    expect(out).toMatchObject({ type: 'track', id: 7 });
  });
  test('returns null for unrecognizable input', () => {
    expect(normalizeResource({})).toBeNull();
  });
});

describe('library-browser normalizers', () => {
  test('track requires a numeric id', () => {
    expect(normalizeTrackForLibraryBrowser({ title: 'no id' })).toBeNull();
  });
  test('playlist artwork falls back to first track artwork', () => {
    const out = normalizePlaylistForLibraryBrowser({
      id: 7, title: 'P', tracks: [{ artwork_url: 'a.jpg' }],
    });
    expect(out.artwork_url).toBe('a.jpg');
    expect(out.track_count).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — module missing.

- [ ] **Step 3: Move the code.** Create `server/lib/normalize.js` with a one-line header comment (`/** Pure normalizers shaping SoundCloud API resources for our responses. */`), then CUT these functions from `api.js` verbatim and paste with `export function` added: `extractNumericId` (api.js ~140-151), `normalizeResource` (~183-231), `normalizeResourceV2` (~233-274), `normalizeTrackForLibraryBrowser` (~276-292), `normalizePlaylistForLibraryBrowser` (~294-312). In `api.js` add: `import { extractNumericId, normalizeResource, normalizeResourceV2, normalizeTrackForLibraryBrowser, normalizePlaylistForLibraryBrowser } from '../lib/normalize.js';`

- [ ] **Step 4: Verify nothing else referenced them locally** — `grep -n "extractNumericId\|normalizeResource\|ForLibraryBrowser" server/routes/api.js` → only import + call sites, no definitions. Run `npm test` — PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/normalize.js server/routes/api.js tests/normalize.test.js
git commit -m "refactor: extract pure resource normalizers to lib/normalize.js with unit tests"
```

---

### Task 9: Extract the resolve cache to `server/lib/resolve-cache.js`

**Files:**
- Create: `server/lib/resolve-cache.js`
- Modify: `server/routes/api.js` (remove lines ~116-181 cache block; update read/write sites)
- Test: `tests/resolve-cache.test.js`

**Interfaces:**
- Produces: named exports `getCachedResolve(url) -> data | undefined`, `setCachedResolve(url, data)`, `resolveCacheSize() -> number`, `clearResolveCache()` from `server/lib/resolve-cache.js`. TTL 5 min, max 1000 entries — identical policy to today (`api.js:117-118`).

- [ ] **Step 1: Write the failing test**

Create `tests/resolve-cache.test.js`:

```js
const { getCachedResolve, setCachedResolve, resolveCacheSize, clearResolveCache } =
  await import('../server/lib/resolve-cache.js');

beforeEach(() => clearResolveCache());

test('set then get round-trips', () => {
  setCachedResolve('https://soundcloud.com/a', { id: 1 });
  expect(getCachedResolve('https://soundcloud.com/a')).toEqual({ id: 1 });
});

test('unknown keys return undefined', () => {
  expect(getCachedResolve('https://soundcloud.com/nope')).toBeUndefined();
});

test('cache is capped at 1000 entries', () => {
  for (let i = 0; i < 1200; i++) setCachedResolve(`https://soundcloud.com/t${i}`, { i });
  expect(resolveCacheSize()).toBeLessThanOrEqual(1001); // prune runs before insert
});
```

- [ ] **Step 2: Run to verify it fails** — module missing.

- [ ] **Step 3: Create `server/lib/resolve-cache.js`** (prune logic moved verbatim from `api.js:163-181`):

```js
/** In-memory cache for /api/resolve results. Per-process; resets on restart
 * (documented limitation — single-instance deploy). */
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const RESOLVE_CACHE_MAX_ENTRIES = 1000;
const resolveCache = new Map(); // key: sanitized URL, value: { data, expiresAt }

function pruneResolveCache() {
  const now = Date.now();
  for (const [key, value] of resolveCache.entries()) {
    if (!value || value.expiresAt <= now) resolveCache.delete(key);
  }
  if (resolveCache.size <= RESOLVE_CACHE_MAX_ENTRIES) return;
  const overflow = resolveCache.size - RESOLVE_CACHE_MAX_ENTRIES;
  let removed = 0;
  for (const key of resolveCache.keys()) {
    resolveCache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function getCachedResolve(url) {
  const entry = resolveCache.get(url);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.data;
}

export function setCachedResolve(url, data) {
  pruneResolveCache();
  resolveCache.set(url, { data, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS });
}

export function resolveCacheSize() { return resolveCache.size; }
export function clearResolveCache() { resolveCache.clear(); }
```

- [ ] **Step 4: Rewire `api.js`.** Find every use: `grep -n "resolveCache\|setResolveCache\|pruneResolveCache\|RESOLVE_CACHE" server/routes/api.js`. Delete the block at ~116-119 and the `pruneResolveCache`/`setResolveCache` functions (~163-181). Replace read sites (currently `resolveCache.get(key)` + expiry check) with `getCachedResolve(key)` and write sites `setResolveCache(key, data)` with `setCachedResolve(key, data)`, preserving surrounding logic exactly. Add `import { getCachedResolve, setCachedResolve } from '../lib/resolve-cache.js';`

- [ ] **Step 5: Run full suite** — `npm test` — PASS. Also `grep -n "resolveCache" server/routes/api.js` → only the import line remains.

- [ ] **Step 6: Commit**

```bash
git add server/lib/resolve-cache.js server/routes/api.js tests/resolve-cache.test.js
git commit -m "refactor: extract resolve cache to lib/resolve-cache.js with eviction tests"
```

---

### Task 10: Consolidate the three followed-library pagination handlers

**Files:**
- Modify: `server/routes/api.js:1647-1751` (the three `router.get('/followings/:userId/...-paged', ...)` handlers)

**Interfaces:**
- Consumes: `assertFollowedUser(req, userId)` (existing helper in api.js), `normalizeTrackForLibraryBrowser` / `normalizePlaylistForLibraryBrowser` (from Task 8's `lib/normalize.js`).
- Produces: internal helper `followedLibraryPageHandler(fetchPage, normalizeItem)` in `api.js` — NOT exported. Response JSON for all three routes must be byte-identical to before.

- [ ] **Step 1: Record current behavior.** Read the three handlers (`/followings/:userId/likes/paged`, `/followings/:userId/playlists/paged`, `/followings/:userId/liked-playlists/paged`) in full. Write down for each: the client method called (e.g. `getUserLikedTracksPage`), the normalizer used, every response field (including whether `targetUser` is echoed), and every error branch (the `assertFollowedUser` 403, statuses read off thrown errors). If the three differ in ANY response field, keep that difference — parameterize it.

- [ ] **Step 2: Write the shared handler** in `api.js` directly above the first of the three routes, shaped like:

```js
/** The three followed-user library pages differ only in which client method
 * fetches the page and which normalizer shapes items. */
function followedLibraryPageHandler(fetchPage, normalizeItem) {
  return async (req, res) => {
    try {
      const targetUser = await assertFollowedUser(req, req.params.userId);
      const page = await fetchPage(req);
      const collection = (Array.isArray(page.collection) ? page.collection : [])
        .map(normalizeItem)
        .filter(Boolean);
      // Preserve the exact response shape recorded in Step 1 — adjust the
      // object below to match it field-for-field before replacing the routes.
      res.json({ user: targetUser, collection, next_href: page.next_href || null });
    } catch (error) {
      const status = error?.status === 403 ? 403 : 500;
      // reuse the exact logging + error message from the original handlers
      logger.error(`Followed library page error for ${req.params.userId}:`, safeError(error));
      res.status(status).json({ error: error?.status === 403 ? error.message : 'Failed to fetch page' });
    }
  };
}
```

The `res.json` object and catch branch MUST be adjusted to match Step 1's recording exactly — the code above is the shape, Step 1's reading is the source of truth.

- [ ] **Step 3: Replace the three routes** with registrations like:

```js
router.get(
  '/followings/:userId/likes/paged',
  authenticateUser,
  validateFollowingUserId,
  validateFollowedUserLibraryPagination,
  followedLibraryPageHandler(
    (req) => soundcloudClient.getUserLikedTracksPage(req.accessToken, req.refreshToken, req.params.userId, {
      limit: req.query.limit || 50,
      next: req.query.next,
    }),
    normalizeTrackForLibraryBrowser
  )
);
```

(one per route, keeping each route's exact validator chain and client call).

- [ ] **Step 4: Verify.** `npm test` — PASS. `git diff server/routes/api.js` — confirm the only changes are the three handlers + new helper, and each response field survives.

- [ ] **Step 5: Commit**

```bash
git add server/routes/api.js
git commit -m "refactor: consolidate three followed-library pagination handlers into one parameterized handler"
```

---

### Task 11: Extract growth routes to `server/routes/growth.js`

**Files:**
- Create: `server/lib/social-cache.js`, `server/routes/growth.js`
- Modify: `server/routes/api.js` (remove growth section ~2710-3231 and the cache helpers ~62-105), `server/index.js` (mount)

**Interfaces:**
- Produces: `server/lib/social-cache.js` named exports `CACHE_TTL`, `getCachedUserPayload`, `invalidateUserNamespaces`, `loadCachedFollowings(req)`, `loadCachedFollowers(req)`, `invalidatePlaylistState(userId)` — bodies moved VERBATIM from `api.js:62-105`, imports adjusted (`requestCache` from `./request-cache.js`, `soundcloudClient` from `./soundcloud-client.js` — confirm the exact import specifiers by copying them from the top of `api.js`). `server/routes/growth.js` default-exports an Express router whose route paths keep their `/growth/...` prefix; `index.js` mounts it at `/api` so URLs are unchanged.

- [ ] **Step 1: Map the boundary.** Run:

```bash
grep -n "growthEngine\|GrowthEngine" server/routes/api.js
grep -n "loadCachedFollowings\|loadCachedFollowers\|getCachedUserPayload\|invalidateUserNamespaces\|invalidatePlaylistState\|CACHE_TTL" server/routes/api.js
grep -n "router.\(get\|post\)('/growth" server/routes/api.js
```

Confirm: (a) `growthEngine` is used ONLY inside the `/growth/*` routes; (b) which non-growth routes also use the cache helpers (those keep importing from the new lib). If (a) is false, report before proceeding.

- [ ] **Step 2: Create `server/lib/social-cache.js`** — move `CACHE_TTL` (api.js:62-69), `getCachedUserPayload` (71-78), `invalidateUserNamespaces` (80-84), `loadCachedFollowings` (89-94), `loadCachedFollowers` (96-101), `invalidatePlaylistState` (103-105) verbatim with `export` added, plus the two imports. In `api.js`, delete those definitions and add `import { CACHE_TTL, getCachedUserPayload, invalidateUserNamespaces, loadCachedFollowings, loadCachedFollowers, invalidatePlaylistState } from '../lib/social-cache.js';`. Run `npm test` — PASS before continuing.

- [ ] **Step 3: Create `server/routes/growth.js`.** Move the entire growth section (every `router.get/post('/growth/...')` handler, from `/growth/discover` at ~2710 through the last growth route at ~3231) verbatim into the new file with this frame:

```js
import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { logOperation } from '../lib/analytics.js';
import { authenticateUser } from '../middleware/auth.js';
import { heavyOperationRateLimiter } from '../middleware/rateLimiter.js';
import { soundcloudClient } from '../lib/soundcloud-client.js';
import { sleep } from '../lib/pacing.js';
import { loadCachedFollowings, loadCachedFollowers } from '../lib/social-cache.js';
// Copy the growth validator imports and the GrowthEngine import block
// (with its constants) EXACTLY as they appear at the top of api.js.

const growthEngine = new GrowthEngine(soundcloudClient);
const router = express.Router();

// ... moved /growth/* routes, unmodified ...

export default router;
```

Fix up imports until `node --check server/routes/growth.js` passes; remove the now-unused growth imports (and the `growthEngine` instantiation at api.js:58) from `api.js`.

- [ ] **Step 4: Mount in `server/index.js`.** Next to the other route imports add `import growthRoutes from './routes/growth.js';` and after `app.use('/api', apiRoutes);` add `app.use('/api', growthRoutes);` (paths inside the router already carry `/growth`, so URLs are unchanged).

- [ ] **Step 5: Verify.** `npm test` — PASS. `wc -l server/routes/api.js` — expect ≈2,600. `NODE_ENV=development node --check server/routes/api.js` (syntax). Boot check: `NODE_ENV=development node server/index.js` starts without import errors (Ctrl-C after the "Server running" line; DB connection failures at request time are fine, import errors are not).

- [ ] **Step 6: Commit**

```bash
git add server/lib/social-cache.js server/routes/growth.js server/routes/api.js server/index.js
git commit -m "refactor: extract growth routes to routes/growth.js and shared social cache loaders to lib/social-cache.js"
```

---

### Task 12: Developer docs — CLAUDE.md accuracy, AGENTS.md stub, SECURITY.md invariants

**Files:**
- Modify: `CLAUDE.md`, `docs/SECURITY.md`
- Replace: `AGENTS.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Regenerate ground truth**

```bash
ls server/routes server/lib server/middleware
grep '^model' prisma/schema.prisma
grep -n "router\.\(get\|post\|put\|delete\|patch\)(" server/routes/*.js | sed 's/:.*router\./ /' | head -80
```

- [ ] **Step 2: Fix CLAUDE.md.** Make these corrections (keep everything that is still accurate — the auth-flow, cookie, and key-features sections are good):
  - The `server/routes/api.js` line claiming "ALL route handlers": replace with a listing of the FIVE route files (`api.js` — core tools, `growth.js` — growth suite, `admin.js` — admin dashboard/catalog, `auth.js` — OAuth/session/account, `feedback.js` — beta survey) with one-line descriptions.
  - Replace every `server/utils/` reference with `server/lib/` and update the project-structure tree from Step 1's actual output (list the lib modules with one-line purposes).
  - Data Model section: replace "User + Token models" framing with the full model list from `grep '^model' prisma/schema.prisma`, a one-line purpose each; keep the detailed User/Token tables.
  - API endpoint table: add the missing route families (growth, admin, library, transfer/compare/clone, exports) at least as section stubs with the route list from Step 1; state that `docs/api.json` (if current) is the machine-readable inventory.
  - Add the two Phase-1 security notes: sessions carry `iat` and expire after 7 days server-side; state-changing `/api` requests with an untrusted `Origin` are rejected (`rejectUntrustedOrigin`).

- [ ] **Step 3: Replace AGENTS.md** entire contents with:

```markdown
# AGENTS.md

This file previously duplicated CLAUDE.md and drifted out of date.
CLAUDE.md is the single authoritative project brief — read that instead.
Session state lives in STATE.md.
```

- [ ] **Step 4: Append to `docs/SECURITY.md`:**

```markdown
## CSRF model

Production cookies are `SameSite=None` (frontend and API live on different
subdomains), so CSRF is handled in layers: (1) `rejectUntrustedOrigin`
middleware rejects state-changing `/api` requests whose `Origin` header is not
in the allowlist; (2) `express.json()` is deliberately the ONLY body parser —
cross-site HTML form posts (urlencoded/text-plain) parse to an empty body and
every mutating route's validator fails closed. Do not add
`express.urlencoded()` without revisiting this section.
`tests/routes/origin.test.js` and `tests/routes/feedback-authz.test.js` are
the regression tests for both layers.

## Session lifetime

Sessions are HMAC-SHA256-signed cookies carrying `iat`; they expire 7 days
after issuance server-side (`SESSION_TTL_MS`) regardless of cookie replay.
Known limitation: there is no server-side revocation list — logout clears the
cookie but a previously exfiltrated cookie stays valid until its TTL.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md AGENTS.md docs/SECURITY.md
git commit -m "docs: make CLAUDE.md match the actual architecture, stub AGENTS.md, document CSRF/session invariants"
```

---

### Task 13: README stats + LICENSE + resolve README-QUESTIONS.md

**Files:**
- Modify: `README.md`
- Create: `LICENSE`
- Delete: `README-QUESTIONS.md`

**Interfaces:** none. Cole's inputs: stats already provided (2026-08-25: **3,570 lifetime users, 2,032,233 tracks processed**); LICENSE = MIT unless he objects; provenance sentence — ask, and if unavailable skip it (do not invent one).

- [ ] **Step 1: Update README stats.** `grep -n "3,155\|1,125,105\|1,216" README.md` — update the user total to `3,570` and tracks to `2,032,233`, change the as-of date to `August 25, 2026`, and append the attribution sentence: `Numbers come from the production operation_log table (see ANALYSIS.md for methodology).` Leave the 90-day-active figure with its original date if no fresh number exists — do not extrapolate one.

- [ ] **Step 2: Add provenance + license lines.** If Cole supplied the one-line origin story, place it where the `<!-- TODO: verify -->` marker sits (or in the intro if no marker); otherwise remove the marker and move on. Add a License section at the bottom: `MIT — see [LICENSE](LICENSE).`

- [ ] **Step 3: Create `LICENSE`** with the standard MIT text, `Copyright (c) 2026 Cole Hackman`.

- [ ] **Step 4: Delete the questions file** — `git rm README-QUESTIONS.md` (its four questions are now resolved: provenance handled in Step 2, license in Step 3, landing claim in Task 14, attribution in Step 1).

- [ ] **Step 5: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: refresh production stats (2026-08-25), add MIT license and stats attribution, resolve README questions"
```

---

### Task 14: Landing claim fix + final verification

**Files:**
- Modify: `frontend-UI/src/app/page.tsx:339`

**Interfaces:** none. Default copy is Cole-approved via the plan; he may override the exact wording.

- [ ] **Step 1: Replace the unbacked claim.** At `page.tsx:339`, replace the text `Trusted by 2,000+ DJs & producers` with `Trusted by 3,500+ SoundCloud users` (backed by the 2026-08-25 figure of 3,570; README documents the source). Touch NOTHING else on the landing page — the headline and animations are settled decisions in STATE.md.

- [ ] **Step 2: Build the frontend.** `cd frontend-UI && npm run build && cd ..` — must succeed.

- [ ] **Step 3: Full final verification.** `npm test` (all suites green — expect 24+ suites now) and `git log --oneline main..HEAD` (expect ~14 commits matching this plan).

- [ ] **Step 4: Commit**

```bash
git add frontend-UI/src/app/page.tsx
git commit -m "fix(landing): replace unbacked social-proof line with verified user count"
```

- [ ] **Step 5: Ship.** Push the branch, open a PR to `main` summarizing the review (`docs/engineering-review-2026-08-25.md`) and noting the one user-facing behavior change (everyone re-logs-in once due to session `iat`). After Cole merges and the platforms deploy: run the `/verify-deploy` skill against the live site (landing copy + login flow + one authenticated call), then run the `/handoff` skill to rewrite `STATE.md` (it is July-dated and stale).

---

## Self-Review Notes

- Spec coverage: review §9 commits 1–12 map to Tasks 1–14 (commit 1→Task 1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7, 8→Tasks 8+9, 9→Tasks 10+11, 10→12, 11→13, 12→14). §5 P0 tests land in Tasks 1–3; P1 tests 5/7/8 land in Tasks 1/4/5. P1 test 6 (token refresh through middleware) and §8 Phase 4 benchmarks are deliberately deferred — optional per the review.
- Known judgment points for the executor: Task 10 Step 1 (record exact response shapes before consolidating) and Task 11 Step 1 (confirm growthEngine isolation) are the two places where reading must precede editing; both have explicit stop-and-report instructions.
- Types/names used across tasks were verified against the live code in this session: `authenticateUser`, `adminAuth`, prisma default export, `betaSignup.findUnique` where-shape, session function signatures, fetch call sites, sleep line numbers.
