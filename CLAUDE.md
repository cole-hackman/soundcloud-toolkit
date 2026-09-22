# CLAUDE.md — Track Toolkit Project Brief

## Project Overview

Track Toolkit (formerly SoundCloud Toolkit — SoundCloud's API Terms of Use forbid "SoundCloud" in an app's name or its domain) is a full-stack web application for SoundCloud power users who need bulk management capabilities the official platform doesn't provide. It solves the 500-track playlist limit with automatic playlist splitting, enables batch operations (bulk unlike, bulk unfollow, bulk repost removal, playlist merging), converts liked tracks or activity feeds into playlists, resolves SoundCloud URLs to structured metadata, and provides a playlist health checker. The backend acts as a secure OAuth2 proxy—all SoundCloud API calls flow through it so credentials never reach the browser.

---

## Tech Stack

### Backend (`server/`)
- **Node.js** with **Express.js** — HTTP server, routing, middleware
- **Prisma ORM** with **PostgreSQL** — data persistence. Production is **Azure
  Database for PostgreSQL Flexible Server** (`tracktoolkit-pg`, PG 17), since
  the 2026-09-20 cutover in `docs/internal/MIGRATION.md`. Neon is the legacy
  database, kept read-only until decommission — nothing reads it
- **`express-validator`** — input validation middleware
- **`helmet`** — security headers (CSP, HSTS, etc.)
- **`express-rate-limit`** — per-IP rate limiting
- **`cookie-parser`** — session cookie parsing
- **`compression`** — gzip response compression
- **`cors`** — CORS allowlist enforcement
- **`dotenv`** — env var loading
- Node's built-in `crypto` module — AES-256-GCM token encryption, HMAC-SHA256 session signing, PKCE pair generation
- **Jest** — unit testing (`tests/`)

### Frontend (`frontend-UI/`)
- **Next.js 15** (React 18) — app router, static export (`output: 'export'`), `trailingSlash: true`
- **TypeScript**
- **Tailwind CSS 3.4** with `frontend-UI/tailwind.config.ts` — **not v4**. Colors
  are `hsl(var(--token))` against the tokens in `src/app/globals.css`; every
  pair the app relies on is checked by `npm run contrast`, which fails the
  build below its threshold
- **shadcn/ui** (custom components in `src/components/ui/`) — Button, Card,
  Input, LoadingSpinner, EmptyState, Skeleton, plus the accessibility
  primitives added on `feat/trust-and-mobile`: `Field`, `Select`, `Dialog`
  (+ `variant="sheet"`/`"drawer"`), `IconButton`, `InlineAlert`, `ProgressBar`,
  `SectionHeading`, `SelectableRow`/`SelectableList`, `SelectionBanner`,
  `PageContainer`, `PageHeader`, `ResultPanel`, `LiveRegion`, `useAnnounce`,
  `useDialog`
- **Space Grotesk** + **Plus Jakarta Sans** — fonts via `next/font`, self-hosted into the export
- **Playwright + `@axe-core/playwright`** (`frontend-UI/e2e/`) — the end-to-end
  suite runs against the built static export at 1280/430/390/360, asserting
  zero serious or critical axe violations, no horizontal overflow, and the
  keyboard behaviour of the shared primitives. `npm run test:e2e`
- Built to `frontend-UI/out/` and served by the Express backend from one origin on **Azure App Service**
- **No third-party scripts and no analytics.** No Google Analytics, no Vercel
  Analytics or Speed Insights, no tag manager, no widget CDN, no external font
  host. The CSP in `server/middleware/security.js` names no third-party script,
  style or font source (only SoundCloud, in `connectSrc`), and
  `tests/security-headers.test.js` fails if one is added back

---

## Project Structure

```
soundcloud-tool/
├── server/
│   ├── index.js                  # Express entry point; middleware stack, route mounting, static serving, error handler
│   ├── routes/                   # FIVE route files (api.js is no longer "everything")
│   │   ├── api.js                # Core tools — playlists, likes, followings, reposts, resolve, library, transfer/compare/clone, exports, proxy-download
│   │   ├── growth.js             # Growth/discovery suite — /growth/* (discover, engage, analytics, history, follow-backs, reverse, stats)
│   │   ├── admin.js              # Admin dashboard — stats, operations, catalog, feedback (every route is authenticateUser + adminAuth)
│   │   ├── auth.js               # OAuth2+PKCE login/callback, session /me, logout, disconnect, export, account deletion
│   │   └── feedback.js           # In-app feedback form (POST /, GET /mine) + the retired rebrand name vote
│   ├── lib/
│   │   ├── soundcloud-client.js  # SoundCloud API wrapper — token exchange, pagination, 401 refresh, 429 backoff, 30s fetch timeout
│   │   ├── session.js            # signSession/unsignSession (HMAC-SHA256, timing-safe), parseSessionData (iat/TTL), SESSION_TTL_MS
│   │   ├── crypto.js             # encrypt() / decrypt() using AES-256-GCM
│   │   ├── pkce.js               # createPkcePair() — code verifier + SHA256 challenge
│   │   ├── prisma.js             # Prisma singleton + transient-connection retry extension (idle drops)
│   │   ├── logger.js             # Sanitizing logger — redacts secrets in messages AND data, all levels
│   │   ├── safe-error.js         # Client-safe error payload builder
│   │   ├── analytics.js          # logOperation() → OperationLog; operation timers, client info
│   │   ├── normalize.js          # Pure resource normalizers (track/playlist/user, library-browser shapes)
│   │   ├── pacing.js             # Shared sleep() + SC_WRITE_PACING_MS (300ms) — the single source for write pacing
│   │   ├── resolve-cache.js      # In-memory /api/resolve cache (5-min TTL, 1000-entry cap)
│   │   ├── social-cache.js       # Per-user collection cache + read-through tiering (loadUserCollection, loadCachedPlaylists)
│   │   ├── snapshot-cache.js     # Postgres tier — page rows, stale-while-revalidate, fails soft
│   │   ├── auth-cache.js         # 30s memo of user + decrypted tokens (see Landmines in docs/internal/STATE.md)
│   │   ├── request-cache.js      # Generic namespaced per-user TTL cache backing social-cache
│   │   ├── merge-utils.js        # Dedup + 500-track chunking for merge/from-likes
│   │   ├── playlist-transfer.js  # Move/duplicate a track between playlists
│   │   ├── playlist-compare.js   # Diff two playlists
│   │   ├── playlist-pages.js     # One page of playlists-with-tracks, sliced from the cached list
│   │   ├── playlist-search.js    # Keyword matching + pure track-list surgery
│   │   ├── library-audit.js      # Blocked/non-streamable summary across the library
│   │   ├── dashboard-summary.js  # Dashboard aggregate payload
│   │   ├── catalog.js            # Music-catalog harvest/upsert (Track, Playlist tables)
│   │   ├── enrichment.js         # Piggybacked track metadata backfill
│   │   ├── download-utils.js     # Download URL + CDN redirect allowlists
│   │   ├── growth-engine.js      # Discovery scoring, follow budget, background engagement jobs
│   │   ├── growth-scheduler.js   # Daily follow-back check scheduler (GROWTH_AUTOCHECK)
│   │   ├── account-lifecycle.js  # disconnectUser() — sign-out, token deletion, cache teardown
│   │   ├── retention.js          # Daily purge job + runRetentionOnce() + lifetime-user snapshot
│   │   └── token-context.js      # AsyncLocalStorage token context for refresh propagation
│   ├── middleware/
│   │   ├── auth.js               # authenticateUser() — session cookie → DB user → decrypted tokens
│   │   ├── adminAuth.js          # adminAuth() — req.user.soundcloudId ∈ ADMIN_IDS; fails closed when unset
│   │   ├── security.js           # securityHeaders, preventKeyLeakage, validateEnv, rejectUntrustedOrigin
│   │   ├── validation.js         # express-validator rule sets (merge, bulk-unlike, resolve, growth, survey, feedback, etc.)
│   │   └── rateLimiter.js        # Five per-IP limiters (api, auth, heavy, library-read, health) plus
│   │                             #   createUserLimiter() and the two per-USER feedback limiters
│   └── package.json
├── frontend-UI/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/            # Protected route group — all dashboard tools
│   │   │   │   ├── dashboard/    # Main hub page
│   │   │   │   ├── combine/      # Merge playlists
│   │   │   │   ├── likes-to-playlist/
│   │   │   │   ├── like-manager/
│   │   │   │   ├── following-manager/
│   │   │   │   ├── following-library/
│   │   │   │   ├── playlist-modifier/
│   │   │   │   ├── playlist-cloner/
│   │   │   │   ├── playlist-compare/
│   │   │   │   ├── playlist-to-likes/
│   │   │   │   ├── playlist-health-check/
│   │   │   │   ├── playlist-keyword-search/
│   │   │   │   ├── link-resolver/
│   │   │   │   ├── batch-link-resolver/
│   │   │   │   ├── activity-to-playlist/
│   │   │   │   ├── recently-played/
│   │   │   │   ├── repost-manager/
│   │   │   │   ├── library-audit/
│   │   │   │   ├── genre-search/
│   │   │   │   ├── growth/
│   │   │   │   ├── export/
│   │   │   │   ├── downloads/
│   │   │   │   ├── feedback/     # In-app "Send feedback" form + the user's own last 20
│   │   │   │   ├── account/      # Export, disconnect, delete — the three exits, in one place
│   │   │   │   ├── AppGroupLayout.tsx
│   │   │   │   └── layout.tsx    # App shell with sidebar and auth guard
│   │   │   ├── admin/            # Admin console (page.tsx + layout.tsx); UI lives in components/admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   ├── terms/page.tsx    # Terms of service. GOVERNING_LAW_STATE is a "[STATE]" placeholder Cole must fill
│   │   │   ├── faq/page.tsx      # FAQ + FAQPage structured data (the old names are allowed in its title/meta)
│   │   │   ├── accessibility/page.tsx  # Statement + the KNOWN_ISSUES list
│   │   │   ├── extension/connected/    # Landing page for the browser-extension OAuth hand-off
│   │   │   ├── not-found.tsx     # 404 (the static export writes out/404.html; Express answers 404)
│   │   │   ├── layout.tsx        # Root layout — site-wide metadata + StructuredData
│   │   │   │                     #   Every page is "use client", so per-route <title>/description/
│   │   │   │                     #   canonical live in a sibling server `layout.tsx` (about,
│   │   │   │                     #   accessibility, faq, login, privacy, terms, admin, and (app)
│   │   │   │                     #   which sets noindex). Inside (app), `usePageTitle` sets the
│   │   │   │                     #   per-tool title at runtime.
│   │   │   └── page.tsx          # Landing page
│   │   ├── components/
│   │   │   ├── ui/               # Primitives. Forms: Field, Select, Input. Overlays: Dialog (+ useDialog),
│   │   │   │                     #   ConfirmDialog. Controls: Button, IconButton. Feedback: InlineAlert,
│   │   │   │                     #   ProgressBar, ResultPanel, LiveRegion + useAnnounce, EmptyState, Skeleton.
│   │   │   │                     #   Layout: PageContainer, PageHeader, SectionHeading, Card.
│   │   │   │                     #   Lists: SelectableRow/SelectableList, TrackRow, SelectionBanner,
│   │   │   │                     #   BulkReviewDetails
│   │   │   ├── admin/            # Admin console — AdminConsole shell, typed react-query hooks, views/ (Overview, Operations, Performance, Catalog, Feedback, Archive)
│   │   │   ├── export/           # ListExportCard / TrackExportCard / ExportBackLink
│   │   │   ├── AppShell.tsx      # Sidebar layout wrapper
│   │   │   ├── AppLayout.tsx     # Auth guard + react-error-boundary wrapper
│   │   │   ├── AppErrorFallback.tsx  # "Something went wrong" — what the e2e crash guard looks for
│   │   │   ├── StructuredData.tsx    # JSON-LD (no third-party script; inline only)
│   │   │   ├── RebrandBanner.tsx  # Site-wide "now Track Toolkit" strip (localStorage-gated)
│   │   │   ├── RebrandAnnouncement.tsx      # Auth gate for the one-time rebrand modal
│   │   │   ├── RebrandAnnouncementModal.tsx # The modal itself
│   │   │   ├── WhatsNewModal.tsx  # Feature announcement (yields to the rebrand modal)
│   │   │   ├── SupportLink.tsx   # mailto: link to the shared support address
│   │   │   └── Providers.tsx     # Context aggregator
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx   # isAuthenticated, user, login(), logout()
│   │   │   └── ThemeContext.tsx
│   │   └── lib/
│   │       ├── support.ts        # SUPPORT_EMAIL — the one definition; never hardcode the address
│   │       ├── nav.ts            # The tool list behind the sidebar, the dashboard and the FAQ
│   │       ├── usePageTitle.ts   # Per-route <title> (only the root layout may export `metadata`)
│   │       ├── rebrand.ts        # REBRAND_ANNOUNCEMENT_VERSION + the localStorage gates
│   │       ├── api.ts / api-shape.ts  # fetch wrapper + the `asArray` degraded-payload guards
│   │       └── utils.ts          # cn()
│   ├── e2e/                      # Playwright: a11y (axe), mobile (overflow), long-titles, drawer,
│   │                             #   sidebar, navigation, loading, degraded-payloads, primitives,
│   │                             #   account, feedback + fixtures/ (api.ts mock, ready.ts settle markers)
│   ├── scripts/contrast-check.mjs  # `npm run contrast` — the colour-token gate
│   ├── playwright.config.ts      # Four projects: desktop 1280, m430, m390, m360. E2E_PORT
│   ├── next.config.js            # Static export config, API rewrites for dev
│   ├── tailwind.config.ts        # Tailwind 3.4 — the tokens live in src/app/globals.css
│   └── package.json
├── tests/                        # Jest suites — lib units plus tests/routes/ (supertest authz/CSRF boundaries)
├── prisma/
│   └── schema.prisma             # Single source of truth for the schema (18 models)
├── infra/                        # Azure as code — main.bicep, deploy.sh, main.cutover.bicepparam, README.md
├── .github/workflows/            # azure-deploy.yml (every push to main), keep-api-warm.yml
├── docs/                         # Engineering review, SECURITY.md, perf audit, plans, incidents,
│                                 #   sql/ migrations, api.json (SoundCloud's upstream spec)
├── .do/app.yaml, vercel.json     # RETIRED — the pre-cutover DigitalOcean and Vercel configs,
│                                 #   kept as rollback until those accounts are decommissioned
├── package.json                  # Root scripts (dev, build, server, test)
├── docs/internal/                # STATE.md (session state + decisions — read first), MIGRATION.md,
│                                 #   ANALYSIS.md, DATA-COLLECTION.md, NOTES.md, TERMS-CHECK.md
└── CLAUDE.md                     # This file
```


---

## Architecture

### Request Flow

One origin. Express serves the static export **and** `/api` from the same
Azure App Service instance, so there is no browser hop between a frontend host
and a backend host and no cross-site request in the picture.

```
Browser ──HTTPS──▶ https://tracktoolkit.com  (Azure App Service, Linux B1)
                        │
                        │  Express (server/index.js)
                        ├── GET /            ──▶ frontend-UI/out/  (Next.js static export)
                        │
                        │  fetch('/api/...', { credentials: 'include' })  — same origin
                        ▼
                   /api/* routes
                        │
                 [authenticateUser middleware]
                 Session cookie ──▶ DB lookup ──▶ decrypt tokens
                        │                            │
                        │                            ▼
                        │              Azure PostgreSQL Flexible Server
                        │              (tracktoolkit-pg, PG 17)
                        ▼
              soundcloud-client.js
                        │
              GET/POST/PUT/DELETE ──▶ SoundCloud API (v1 or v2)
                        │
                 [auto-refresh on 401]
                 [exponential backoff on 429]
                        │
                        ▼
              JSON response ──▶ Express ──▶ Browser
```

The retired hostnames (`www.tracktoolkit.com`, `soundcloudtoolkit.com`,
`www.`, `api.`) are bound to the same app and 301/308 to the apex from
`server/middleware/legacy-redirect.js`.

### Authentication & Session Flow (OAuth2 + PKCE)

1. **Login initiated**: `GET /api/auth/login`
   - Server generates PKCE pair (`crypto.randomBytes(32)` → base64url verifier, SHA256 challenge)
   - Stores `code_verifier` in httpOnly cookie (`pkce_verifier`, 10-min TTL)
   - Redirects to `https://secure.soundcloud.com/authorize?client_id=...&code_challenge=...`

2. **OAuth callback**: `GET /api/auth/callback?code=...`
   - Reads `code_verifier` from cookie
   - POSTs to `https://secure.soundcloud.com/oauth/token` with code + verifier
   - Receives `{ access_token, refresh_token, expires_in }`
   - Fetches `/me` to get user info
   - Upserts `User` record in DB (by `soundcloudId`)
   - Encrypts both tokens with AES-256-GCM, upserts `Token` record
   - Signs session payload `{ userId, soundcloudId, username, avatarUrl, displayName, iat }` with HMAC-SHA256
   - Sets `session` cookie (httpOnly, secure, sameSite, 7-day)
   - Redirects to `/dashboard`

3. **Authenticated requests**: `authenticateUser` middleware (`server/middleware/auth.js`)
   - Reads `session` cookie, verifies HMAC signature with `crypto.timingSafeEqual`
   - Rejects payloads with no `iat` or older than `SESSION_TTL_MS` (7 days) — the
     lifetime is enforced **inside the signed payload**, so a stolen cookie cannot
     outlive it by ignoring the cookie's own `maxAge`
   - Looks up `User` with `tokens` in DB
   - Decrypts access + refresh tokens
   - Attaches `req.user`, `req.accessToken`, `req.refreshToken` to request

4. **Token refresh**: Handled inside `soundcloud-client.js` → `scRequest()`
   - On 401: calls `refreshTokens(refreshToken)`, updates DB, retries request once

### Cookie Configuration

| Attribute | Dev | Prod |
|-----------|-----|------|
| `httpOnly` | true | true |
| `secure` | false | true |
| `sameSite` | `lax` | `lax` (`SESSION_COOKIE_SAMESITE=lax`) |
| `domain` | (none) | (none) — host-only cookie |
| `maxAge` | 7 days | 7 days |

The cookie is **host-only**: `createSessionCookieOptions()` in
`server/lib/session.js` sets no `domain`, so it is scoped to
`tracktoolkit.com` and nothing else.

Production runs `SameSite=Lax`, set explicitly through
`SESSION_COOKIE_SAMESITE=lax`. It can, because the frontend and the API are
one origin — there is no cross-site request to carry the cookie on. The code
still defaults to `none` when the variable is unset, which is the split-host
value the app shipped with before the Azure cutover; the deployment sets `lax`
rather than relying on that default, so the value is visible in
`infra/main.cutover.bicepparam` instead of implied.

### CSRF & Origin Enforcement

`SameSite=Lax` is now the first line of defence, but it is not treated as the
only one — the value is an environment variable, and the two layers below were
built when it was `None`. Both stay:

1. **`rejectUntrustedOrigin`** (`server/middleware/security.js`, mounted on `/api`
   in `server/index.js`) rejects `POST`/`PUT`/`PATCH`/`DELETE` whose `Origin`
   header is present and not in the allowlist. Requests with no `Origin`
   (same-origin navigations, curl, server-to-server) pass.
2. **`express.json()` is deliberately the only body parser.** A cross-site HTML
   form posts `urlencoded`/`text-plain` with no preflight; those parse to an
   empty `req.body`, so every mutating route's validator fails closed. **Do not
   add `express.urlencoded()`** without revisiting `docs/SECURITY.md`.

Regression tests: `tests/routes/origin.test.js`, `tests/routes/feedback-authz.test.js`.

Known limitation: there is no server-side session revocation list. Logout clears
the cookie, but a previously exfiltrated cookie stays valid until its `iat` TTL
expires.

---

## Data Model

The schema (`prisma/schema.prisma`) has **18 models**, not two:

| Model | Purpose |
|-------|---------|
| `User` | One row per SoundCloud account that has logged in |
| `Token` | AES-256-GCM-encrypted access + refresh token pair (one per user) |
| `OperationLog` | Per-operation analytics record — action, status, duration, track/playlist ids |
| `Track` / `Playlist` | Harvested music catalog (populated opportunistically from resolved/browsed content) |
| `GrowthAction` | Follow/like actions taken by the growth suite, plus follow-back outcomes |
| `Feedback` | In-app feedback form submissions — login-required, stored only here (no email, no webhook). `messageHash` (sha256 of the normalized message) backs a 24-hour per-user duplicate check; `status` is `new\|seen\|done\|spam` and `adminNote` is admin-only |
| `RebrandVote` | Rebrand name-vote responses — the vote is closed, rows retained read-only (`@@unique([userId, campaignId])`) |
| `BetaSignup` | The retired SongSwipe beta survey — retained read-only for history |
| `SurveyResponse` | The retired monetization survey — retained read-only for history |
| `chat_conversations` / `chat_messages` | AI library chat (owned by `feature/ai-library-chat`; declared here so `prisma db push` does not drop them) |
| `indexed_likes` / `indexed_playlist_tracks` / `library_snapshots` | Library indexing for that same feature — same db-push caveat |
| `LibraryCachePage` / `LibraryCacheState` | Persistent tier of the library cache — one row per 200-item page plus a sync-state row. **Not** the same thing as `library_snapshots` above |
| `Metric` | Counters that must outlive the rows they were computed from. One key today: `lifetime_distinct_users`, snapshotted as the first step of every retention run — before any delete in that run. Deliberately **not** per-user, so it is absent from the deletion cascade by design |

The two models this app touches on every request are detailed below.

### `User` (`users` table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) | Internal primary key |
| `soundcloudId` | `Int` (unique) | SoundCloud numeric user ID — used for OAuth upsert |
| `username` | `String` | SC username (URL slug) |
| `displayName` | `String?` | Display name (may differ from username) |
| `avatarUrl` | `String?` | Profile picture URL |
| `lastLoginAt` | `DateTime?` | Stamped by the OAuth callback on every login. Drives the dormant-account purge; null on rows predating the column, which fall back to `updatedAt` |
| `disconnectedAt` | `DateTime?` | Set by `POST /api/auth/disconnect` or by revocation detection; cleared on the next successful login. Rows still stamped after 6 days are deleted by the retention job |
| `createdAt` | `DateTime` | Auto |
| `updatedAt` | `DateTime` | Auto |
| `tokens` | `Token[]` | One-to-many relation (effectively one per user) |

Both new columns are indexed (`@@index([lastLoginAt])`, `@@index([disconnectedAt])`)
so the daily retention sweep is a range scan rather than a full table scan.
Additive SQL: `docs/sql/2026-09-account-lifecycle.sql` (**not applied**).

### `Token` (`tokens` table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) | Internal primary key |
| `userId` | `String` | FK → `users.id` (cascade delete) |
| `encrypted` | `String` | AES-256-GCM encrypted access token (base64) |
| `refresh` | `String` | AES-256-GCM encrypted refresh token (base64) |
| `expiresAt` | `DateTime` | Access token expiry (from SC `expires_in`) |
| `createdAt` | `DateTime` | Auto |
| `updatedAt` | `DateTime` | Auto |

**Unique constraint**: `@@unique([userId])` — enforces one active token set per user. The `upsert` pattern in the callback handler updates tokens on re-login.

**Encryption layout** (per token field): `base64(12-byte IV | 16-byte GCM auth tag | ciphertext)`

---

## API Endpoints

All endpoints (except `/health`, `/`, and auth redirects) require a valid `session` cookie processed by `authenticateUser` middleware. All are under `/api/`.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/login` | Initiates OAuth2 + PKCE; redirects to SoundCloud |
| `GET` | `/api/auth/callback` | Exchanges OAuth code; sets session cookie; redirects to `/dashboard` |
| `POST` | `/api/auth/logout` | Clears `session` cookie; returns `{ success: true }` |
| `GET` | `/api/auth/me` | Returns `{ userId, username, avatarUrl, displayName }` from session |
| `POST` | `/api/auth/disconnect` | Hands the SoundCloud grant back (`signOut`), deletes the `Token` row, stamps `User.disconnectedAt`, drops every cache keyed to the user, clears the session cookie. The account survives; logging back in clears the stamp |
| `GET` | `/api/auth/export` | The caller's full data export as a JSON attachment (`heavyOperationRateLimiter`). Token ciphertext is never included — only `expiresAt` |

Rate limited: `authRateLimiter` (5 requests / 15 min) on `/login` + `/callback` only

`POST /api/auth/disconnect` takes **no body**, so the empty-body fail-closed
CSRF layer has nothing to act on — `rejectUntrustedOrigin` is the whole guard.
`tests/routes/account-deletion.test.js` asserts a cross-site POST gets 403.

### User Profile

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | Full SoundCloud `/me` response (followers_count, likes_count, etc.) |
| `GET` | `/api/playlists` | All of the user's playlists (fully paginated internally via `next_href`); returns `{ collection, total }` |
| `GET` | `/api/playlists/:id` | Single playlist with full `tracks[]` array |
| `GET` | `/api/followers` | All followers (fully paginated); returns `{ collection, total }` |
| `GET` | `/api/followings` | All followings (fully paginated); returns `{ collection, total }` |

### Likes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/likes` | All liked tracks (fully paginated — may be slow for large libraries) |
| `GET` | `/api/likes/paged` | Single page of likes; query: `limit` (default 50, max 200), `next` (cursor URL from prev response); returns `{ collection, next_href }` |
| `GET` | `/api/followings/paged` | Single page of followings; same cursor contract |
| `GET` | `/api/followers/paged` | Single page of followers; same cursor contract |
| `GET` | `/api/reposts/paged` | Offset-paged (`limit`, `offset`) — reposts are assembled from two crawls, so there is no upstream cursor |
| `POST` | `/api/likes/tracks/bulk-unlike` | Unlike multiple tracks; body: `{ trackIds: number[] }` (max 100); returns `{ results: { trackId, status, error? }[] }` |

### Activities & Reposts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/activities` | Activity feed; query: `limit` (1–500); returns normalized tracks |
| `GET` | `/api/reposts` | All user reposts; uses V2 API with V1 fallback (see Key Features) |
| `POST` | `/api/reposts/bulk-remove` | Remove multiple reposts; body: `{ items: { id: number, resourceType: 'track' | 'playlist' }[] }` |

### Playlists (mutations)

All are `heavyOperationRateLimiter` (20 requests / hour).

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/playlists/merge` | `{ sourcePlaylistIds: number[] (2–10), title?: string }` | Fetches, deduplicates, and creates 1–N playlists; auto-splits at 500 tracks |
| `POST` | `/api/playlists/from-likes` | `{ trackIds: number[], title?: string }` | Creates playlist(s) from provided track IDs; auto-splits if >500 |
| `PUT` | `/api/playlists/:id` | `{ tracks: number[], title?: string }` | Update playlist track order / title. Reads the playlist first and 409s if that read came back short of its `track_count` — the body is a full replacement list |

**Merge response:**
```json
{
  "playlists": [{ "id": 123, "title": "Merge (1/2)", "track_count": 500 }],
  "stats": {
    "sourcePlaylists": 3,
    "fetchedTotal": 820,
    "acceptedTotal": 800,
    "uniqueBeforeCap": 750,
    "totalTracks": 750,
    "numPlaylistsCreated": 2
  }
}
```

### URL Resolution

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/resolve` | Single URL resolution; query: `url`; returns normalized metadata |
| `POST` | `/api/resolve` | Same but body: `{ url: string }` |
| `POST` | `/api/resolve/batch` | Batch resolve; body: `{ urls: string[] }` (1–50); returns `{ url, status, data?, error? }[]` |

`heavyOperationRateLimiter` on batch. Results cached in-memory for 5 minutes.

### Social

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/api/followings/bulk-unfollow` | `{ userIds: number[] }` (max 100) | Unfollow multiple users; returns `{ userId, status, error? }[]` |

`heavyOperationRateLimiter`.

### Download Proxy

| Method | Path | Query | Description |
|--------|------|-------|-------------|
| `GET` | `/api/proxy-download` | `url` (SoundCloud download URL) | Proxies download request with auth; only allows `api.soundcloud.com/tracks/:id/download`; redirects to CDN only (sndcdn.com, cloudfront.net, soundcloud.com) |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | `{ status: 'ok', timestamp }`; rate limited 60/min |

### Library, Transfer, Compare & Clone (`routes/api.js`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/library/audit` | Playlist health summary; paged with `limit` (1–50, default 20) + `offset` **into the cached playlist list**, so a library larger than one page can be walked. Returns `page` (with `total`, `hasMore`, `stale`, `truncated`) and `failed[]` |
| `GET` | `/api/playlists/search-tracks` | Keyword search across playlist track lists; `q` (comma-separated terms are OR'd, each ≥2 chars), optional `playlistId` to scope to one, else `limit`/`offset` paging. Returns `matches` (capped at 2,000, with `capped: true` when truncated), `stats`, `failed[]`, `page` |
| `POST` | `/api/playlists/tracks/bulk-remove` | Remove tracks from playlists; body `{ items: [{ playlistId, trackIds }] }` (≤20 playlists, ≤200 tracks total); per-playlist status. Refuses any playlist whose read came back short of its `track_count` |
| `POST` | `/api/playlists/tracks/bulk-add` | Copy tracks into one playlist; body `{ targetPlaylistId, trackIds }` (≤200); skips duplicates, stops at the 500 cap; 409 on a short read |
| `GET` | `/api/recently-played` | Recently played tracks |
| `GET` | `/api/tracks/search` | Track search |
| `GET` | `/api/users/:id/profile` | Public profile of a SoundCloud user |
| `GET` | `/api/users/:id/tracks` | Public tracks of a SoundCloud user |
| `GET` | `/api/users/:userUrn/related` | Related-artist suggestions |
| `GET` | `/api/followings/:userId/likes/paged` | Page of a followed user's public likes |
| `GET` | `/api/followings/:userId/playlists/paged` | Page of a followed user's public playlists |
| `GET` | `/api/followings/:userId/liked-playlists/paged` | Page of a followed user's liked playlists |
| `POST` | `/api/followings/:userId/likes/playlist` | Build a playlist from a followed user's likes |
| `POST` | `/api/followings/:userId/playlists/clone` | Clone a followed user's playlists |
| `POST` | `/api/playlists/clone` | Clone a playlist |
| `POST` | `/api/playlists/compare` | Diff two playlists |
| `POST` | `/api/playlists/transfer-track` | Move or duplicate a track between playlists |
| `DELETE` | `/api/playlists/:id` | Delete a playlist |
| `POST` | `/api/likes/tracks/bulk-like` | Bulk-like tracks |
| `POST` | `/api/events` | Fire-and-forget feature-usage signal (`view:<feature>`) |

The three `/followings/:userId/*/paged` routes share one parameterized handler
(`followedLibraryPageHandler`) — same response shape, different client method
and normalizer.

### Growth & Discovery (`routes/growth.js`)

All `/growth/*` routes are `authenticateUser`; the write-heavy ones also carry
`heavyOperationRateLimiter`. Follow caps are enforced server-side (50/24h +
30-minute session cooldown) regardless of what the client requests.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/growth/discover` | Score and return follow candidates for the chosen seed strategy |
| `GET` | `/api/growth/limits` | Remaining daily follow budget and cooldown state |
| `POST` | `/api/growth/engage` | Start a paced background follow/like batch job |
| `GET` | `/api/growth/engage/status` | Poll the running job |
| `POST` | `/api/growth/engage/cancel` | Cancel the running job |
| `GET` | `/api/growth/analytics` | Per-seed conversion and follow-back curve |
| `GET` | `/api/growth/history` | Past growth actions (CSV-exportable client-side) |
| `POST` | `/api/growth/check-followbacks` | On-demand follow-back reconciliation |
| `POST` | `/api/growth/reverse` | Unfollow previously followed targets (does not refund budget) |
| `GET` | `/api/growth/stats` | Aggregate growth counters |

### Feedback (`routes/feedback.js`)

The live in-app "Send feedback" form. Login-required by decision, so every row
is attributable — which is what lets the write path get away with a honeypot
and a per-user limiter instead of a captcha. Storage is Postgres and nothing
else: no email delivery, no webhook, no third-party widget.

Not to be confused with the retired rebrand name vote, which lives in the same
route file under `/survey` and is documented further down.

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| `POST` | `/api/feedback` | `{ type: 'bug'\|'feature'\|'other', message: string (10–2000), page?: '/route', email?: string, website?: string }` | Records one submission. **201** `{ id, createdAt }`; **400** on an invalid body; **409** `{ error: 'You already sent this recently' }` when the same user sent the same message inside 24h; **202** `{ accepted: true }` — and no row — when the `website` honeypot is filled |
| `GET` | `/api/feedback/mine` | — | The user's own last 20, newest first: `{ items: [{ id, type, page, status, createdAt }] }`. `adminNote` and `message` are deliberately not selected |

**Middleware order is load-bearing**:
`authenticateUser, validateFeedback, feedbackHourlyLimiter, feedbackDailyLimiter, handler`.
The validator runs **before** the limiters, for the same reason
`validateRebrandVote` runs before the closed-campaign gate: a cross-site
form-encoded post parses to an empty `req.body` under `express.json()` and
dies at the validator with a 400. Putting the limiters first would also let a
forged request burn a real user's feedback budget.
`tests/routes/feedback.test.js` asserts that order directly.

`feedbackHourlyLimiter` (5/hour) and `feedbackDailyLimiter` (20/24h) are the
only **per-user** limiters in `rateLimiter.js` — every other tier is per-IP.
They are built by `createUserLimiter()`, which keys on `req.user.id` and only
falls back to `req.ip`. That fallback is unreachable behind `authenticateUser`;
it exists so the key is never `undefined`. Mount one of these in *front* of
`authenticateUser` and it silently becomes a per-IP limiter again.

The honeypot answers **202**, not 400, so automation cannot learn which field
gave it away, and its counter is `logger.debug` (a no-op outside development)
so spam cannot fill the log in place of the table. The `message` and `email`
never appear in any log line.

Three details in `validateFeedback` that look incidental and are not:

- `page` and `email` use `optional({ nullable: true, checkFalsy: true })`, so
  an empty string means **absent**, not malformed. The form posts `''` for an
  input the user never touched; without `checkFalsy` that rejected an
  otherwise valid submission, and the route stores `null`.
- `message` runs `stripControlChars` as a `customSanitizer` **before**
  `.isLength({ min: 10 })`. Measuring first would let ten control characters
  satisfy the minimum and then collapse to an empty stored message. The route
  strips again as belt-and-braces; the function is idempotent and exported
  from `validation.js` so there is one definition, not two that drift.
- Every field leads with `.isString()`, including `type` and `email` where it
  looks redundant. express-validator 7 applies a validator **element-wise to
  an array**, so `{ type: ['bug'] }` satisfies `.isIn()` and
  `{ email: ['a@b.co'] }` satisfies `.isEmail()`; both then reach Prisma as
  arrays and 500. `.isString()` checks the value as a whole and is the only
  thing that closes that door.

### Admin (`routes/admin.js`)

Every admin route runs `authenticateUser` **then** `adminAuth`. `adminAuth`
fails closed: an unset or empty `ADMIN_IDS` 403s everyone.
`tests/routes/admin-auth.test.js` asserts both the boundary and that no route
is registered without the pair.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Top-line usage stats |
| `GET` | `/api/admin/daily` | Daily activity series |
| `GET` | `/api/admin/operations` | Paginated operation log |
| `GET` | `/api/admin/catalog/summary` | Harvested music-catalog summary |
| `GET` | `/api/admin/catalog/tracks` | Catalog track list |
| `GET` | `/api/admin/catalog/tracks/:id/operations` | Operations touching one track |
| `GET` | `/api/admin/catalog/daily` | Per-day track touches, distinct tracks and playlist touches (zero-filled) |
| `GET` | `/api/admin/catalog/playlists` | Harvested playlists with period touches; `q`, sort, paging, `format=csv` |
| `GET` | `/api/admin/catalog/artists` | Catalog rolled up by artist: tracks, touches, not-playable share, unresolved; `format=csv` |
| `POST` | `/api/admin/catalog/re-resolve` | `{ trackIds }` (1–200): forced refetch through the enrichment path with the admin's token. `heavyOperationRateLimiter`; logged as `admin-re-resolve` |
| `GET` | `/api/admin/rebrand/summary` | Rebrand name-vote tally + write-in counts |
| `GET` | `/api/admin/rebrand` | Rebrand vote list (write-in names, feature requests) |
| `GET` | `/api/admin/feedback/summary` | Retired beta-survey aggregates (API only) |
| `GET` | `/api/admin/feedback` | Retired beta-survey response list (API only) |
| `GET` | `/api/admin/feedback/beta-emails` | CSV export of beta opt-in emails (API only) |
| `GET` | `/api/admin/feedback-items` | Live feedback inbox — `?status=&type=&page=1&pageSize=50` (capped at 200); `{ items, total, page, pageSize }`, newest first, sender attached |
| `GET` | `/api/admin/feedback-items/summary` | `{ total, unread, byStatus, byType }` — every bucket seeded at zero |
| `PATCH` | `/api/admin/feedback-items/:id` | Triage: `{ status?, adminNote? }`. 400 on an empty patch, 404 when the row is gone |
| `GET` | `/api/admin/feedback-items.csv` | CSV attachment of the filtered set (`?status=&type=`) |

`/catalog/tracks` also accepts `access=not_playable` (blocked ∪ preview ∪ gone),
sorts on `duration`, `firstSeen` and `lastSeen`, and `format=csv` (the
current filter set, up to 10,000 rows, no COUNT query). The CSV writer and
the day-filling helpers (`periodDayCount`, `fillDays`) are shared by
`/daily` and `/catalog/daily`. `tests/routes/admin-catalog.test.js` covers
the re-resolve guards and the CSV contract.

**`/feedback/*` and `/feedback-items*` are different tables.** `/feedback/*`
is the retired SongSwipe beta survey (`BetaSignup`); `/feedback-items*` is the
live in-app feedback form (`Feedback`). The path spelling is the only thing
keeping them apart, so do not "tidy" one into the other.

**`/feedback-items.csv` guards against formula injection.** `message` and
`adminNote` are free text, and Excel / Sheets / LibreOffice execute a cell that
opens with `=`, `+`, `-`, `@`, tab or CR — so a report reading
`=HYPERLINK("http://evil...")` would fire when an admin opens the export. Cells
starting with any of those get a leading apostrophe, and `\r` is in the
quote-trigger class so a lone carriage return cannot split one report into two
rows. The older `feedback/beta-emails` export does **not** have this guard yet
(its fields are far less free-form) — that is a known follow-up.

The `PATCH` writes `status` and `adminNote` and nothing else — no admin action
can rewrite what a user said. An empty patch is refused rather than issued as a
no-op write, because `updatedAt` is `@updatedAt` and would move anyway, making
the row look freshly triaged. The list filters accept only the enumerated
`status`/`type` values; anything else is dropped rather than passed to Prisma,
so a typo returns everything instead of nothing.

The three `/feedback/*` routes serve the retired SongSwipe beta survey. The
console's Archive view reads `/feedback/summary` and links the beta-emails CSV;
the response list is reachable by URL only.

### Admin console (`frontend-UI/src/components/admin/`)

`/admin` is a tabbed console, not one scrolling page: **Overview** (alert
strip, KPI tiles, activity trend, outcome bar, feature usage/reach, errors),
**Operations** (the searchable log with an inspector drawer), **Performance**
(the `readLatency` p95 ranking and write health), **Catalog**, **Feedback**
(the live in-app inbox) and **Archive** (closed rebrand vote, retired beta
survey). The active view is the URL hash
(`/admin#operations`); keys 1–6 switch views. Catalog has its own sub-views
in the hash (`#catalog/tracks|playlists|artists|health`): the touches
time-series, genre/access bars that filter, Tracks with optional
duration/first-seen/last-seen columns and CSV export, Playlists, the Artists
roll-up (not-playable share per artist), and Health — the blocked / preview /
gone / pending / not-found lists with the console's only write, **Re-resolve**
(`POST /api/admin/catalog/re-resolve`, ≤200 ids per click). An expanded
track row (and each Health row) can mount SoundCloud's embed player on
demand, one at a time; it is a plain iframe on `w.soundcloud.com`, no
token involved. The `frame-src` allowance for it is scoped to the `/admin`
document only: `securityHeaders` in `server/middleware/security.js`
serves a second helmet instance for `isAdminPagePath` and the base policy
(`frame-src 'none'`) everywhere else — `tests/routes/csp-admin-frame.test.js`
pins that. Each view fetches only what it
needs through the hooks in `queries.ts` (react-query; live views re-poll every
30 s while the tab is visible and keep stale data on screen while refetching —
never a skeleton flash). Archive queries are all-time and never poll.

**Feedback is a view, not a panel in Archive.** `views/FeedbackView.tsx` reads
the four `/api/admin/feedback-items*` routes: status tabs (with counts from
`/summary`), a type filter, 25-per-page paging with the total, a clamped
message body that expands in place, the three triage buttons, an admin-note
field that saves on blur and skips a no-op write, the unread badge and the CSV
link. It takes **no period** — it is a queue, not a time series, and an
untriaged report from six weeks ago is still untriaged. Archive is closed,
read-only history; this is the console's one working queue.

The console uses the app's HSL tokens and `ThemeContext` (no private theme),
plus JetBrains Mono via `next/font` from `app/admin/layout.tsx` for readouts.
Access: `AdminConsole` gates on `user.isAdmin` from `/api/auth/me` before any
admin request is made; the sidebar shows an "Admin console" link only to
admins. Server-side `adminAuth` remains the real boundary.

### Account

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/api/auth/account` | Delete the account and cascade-delete all owned rows |

### Account lifecycle & retention

There are three exits, not two. **Logout** forgets the session cookie and
nothing else — the encrypted token pair stays and the next login picks it back
up. **Delete** (`DELETE /api/auth/account`) is irreversible. **Disconnect**
(`POST /api/auth/disconnect`) is the middle: `disconnectUser()` in
[`lib/account-lifecycle.js`](server/lib/account-lifecycle.js) hands the grant
back via `signOut`, deletes the `Token` row, stamps `User.disconnectedAt`, and
drops every cache derived from that grant. The account survives — logging back
in clears the stamp — but the retention job deletes the row after 6 days.

**It must call `invalidateCachedAuth`.** `lib/auth-cache.js` memoizes the
*decrypted* token pair for 30 seconds; without that call a request inside the
window would keep working against tokens that no longer exist. Same landmine
as the refresh path. It runs in a `finally` immediately after the token
delete, so no later failure in the teardown can leave the memo holding
credentials whose row is already gone.

**Revocation is detected, not merely handled.** A user revoking the app from
SoundCloud's own settings never tells this service. `refreshTokensAndPersist`
— the single refresh choke point — treats exactly two things as revocation and
runs the same teardown with `reason: 'revoked'`: `invalid_grant` in a JSON
body on a 400/401, and a 401 with an **empty** body. **A 401 with a non-empty
non-JSON body does not count** — that shape is an HTML error page from a proxy
or WAF far more often than a revocation, and acting on it would destroy a live
user's tokens over someone else's infrastructure. 429, every 5xx, timeouts and
network errors are excluded for the same reason. The thrown error is
unchanged, so callers still see the generic "Token refresh failed".

**Retention** ([`lib/retention.js`](server/lib/retention.js)) runs 10 minutes
after boot and then every `RETENTION_INTERVAL_MS`. A snapshot step plus eight
purges, each one bulk statement, each isolated — a step that throws is logged
(`[retention] <step> removed N`) and the rest still run; `runRetentionOnce()`
never rejects, so the interval cannot die. It is exported for tests and for a
REPL.

| # | Step | Window |
|---|------|--------|
| 0 | Lifetime-user snapshot → `Metric.lifetime_distinct_users` | every run, **first** |
| 1 | `LibraryCachePage` (by `createdAt`) + `LibraryCacheState` (by `updatedAt`) | `CACHE_TTL_DAYS` (7) |
| 2 | Users still stamped `disconnectedAt` | 6 days (constant, see below) |
| 3 | Dormant users (`lastLoginAt`, or `updatedAt` when null) | `INACTIVE_MONTHS` (24) |
| 4 | `OperationLog` purge | `OPLOG_RETENTION_DAYS` (365) |
| 5 | `GrowthAction` | 365 days |
| 6 | `Feedback` (guarded on `prisma.feedback`) | 730 days |
| 7 | `BetaSignup.email` → null | every run |
| 8 | Catalog `gone` rows lose their metadata | every run |

Three things that look arbitrary but are not:

- **Step 0 runs first, before any delete in the run — not merely before the
  log purge.** The user sweeps at steps 2 and 3 cascade into `operation_logs`
  too, so snapshotting after them would drop exactly the departing users the
  all-time figure exists to remember. It is `SELECT COUNT(DISTINCT "userId")`
  via `$queryRaw` (one row out of Postgres, matching the admin aggregates),
  monotonic — a run only ever raises it — and admin `/stats` surfaces it as
  `lifetimeUsers` (null before the first run).
  Every user delete also logs `[retention] <step> will remove N users` *before*
  it runs, so the first production sweep is reviewable from the logs rather
  than only from its aftermath.
- **The disconnect window is 6 days, and a constant, not an env var.** The
  SoundCloud terms' deletion deadline is *7* days; the window is one day short
  of it on purpose, because the sweep is daily and the real worst case is the
  grace period plus up to one `RETENTION_INTERVAL_MS`. At 7 that worst case was
  up to 8 days — past the ceiling. At 6 it is ≈7 and inside it. It is a
  constant so it cannot be pushed past the deadline from a deployment
  dashboard, and `RETENTION_INTERVAL_MS` is clamped to 24h in code for the same
  reason — it would otherwise spend the margin the sixth day buys, from an env
  var and with no signal. See `docs/internal/TERMS-CHECK.md` finding B.
- **`INACTIVE_MONTHS` is calendar months in UTC.** Local-time `setMonth` shifts
  the cutoff by an hour across a DST boundary, making the same input produce
  different cutoffs depending on host timezone and time of year.

`GET /api/auth/export` is the read side of the same story: every row keyed to
the caller, as a dated JSON attachment. The `Token` record contributes
`expiresAt` only — `encrypted` and `refresh` are excluded at the `select`, so
the ciphertext never leaves Postgres. Note that `req.user` is the full row
**with its `tokens` relation included**, which is why the route names fields
explicitly instead of spreading it.

> `docs/api.json` is **SoundCloud's own OpenAPI spec** (68 upstream paths under
> `https://api.soundcloud.com`), kept as a reference for what the upstream API
> offers. It documents none of this app's endpoints and is not an inventory of
> them. The authoritative list of what this server exposes is the source:
> `grep -n "router\." server/routes/*.js`.

### Rebrand announcements (and the retired name vote)

The product renamed from **SoundCloud Toolkit** ("SC Toolkit" in the UI) to
**Track Toolkit**, because SoundCloud's API Terms of Use forbid "SoundCloud" in
an app's name *or* its domain. References to SoundCloud that describe the
platform, the OAuth connection, the API or the trademark position stay — only
product-owned naming moved. **The domain has moved**: `tracktoolkit.com` is
canonical since 2026-09-20, and the remaining `soundcloudtoolkit.com`
references are the legacy hostnames bound to the same app for the 301 (see
Domain Strategy below) plus the historical record in
`docs/internal/MIGRATION.md`.

Two announcements carry the change, both gated in **localStorage only** — no
server call, no table, same posture as `lib/whatsNew.ts`:

| Surface | File | Gate |
|---------|------|------|
| Site-wide banner | [`RebrandBanner.tsx`](frontend-UI/src/components/RebrandBanner.tsx) | `track-toolkit-rebrand-banner` |
| One-time modal | [`RebrandAnnouncementModal.tsx`](frontend-UI/src/components/RebrandAnnouncementModal.tsx) | `track-toolkit-rebrand-ack` |

Both keys are namespaced by `REBRAND_ANNOUNCEMENT_VERSION` in
[`lib/rebrand.ts`](frontend-UI/src/lib/rebrand.ts); bump it to re-announce.
Acknowledging the modal also settles the banner, and
`REBRAND_STATE_EVENT` is what tells the banner (mounted by the root layout)
that the modal (mounted by the `(app)` layout) was acknowledged in this tab.

**Banner layout contract.** The banner sits in normal flow, sticky at `top: 0`
with `z-40`, and publishes its measured height as `--announcement-h` on the
document element. The two `position: fixed` headers that would otherwise sit
under it — the landing nav in `app/page.tsx` and the mobile header in
`AppShell.tsx` — read that variable as their `top`. It is declared `0px` in
`globals.css`, so both are correct before the banner mounts and after it is
dismissed. `z-40` is deliberate: above page content, below the mobile drawer
(z-50) and every modal (z-70).

**Modal ordering — nothing stacks.** The rebrand modal is mounted by the
protected route group's layout, so it fires on first arrival anywhere in the
app, not only on the dashboard. The dashboard's "What's new" effect returns
early while `isRebrandAcknowledged()` is false, so the two never appear
together; "What's new" simply waits for the next visit.

**The name vote is closed.** Track Toolkit won (48/165), and
`REBRAND_VOTE_CONCLUDED` in [`routes/feedback.js`](server/routes/feedback.js)
retires the write path in code rather than by environment variable:
`GET /api/feedback/survey/status` reports `{ enabled: false, concluded: true,
decidedName }` and `POST /api/feedback/survey` answers **410**. The client
modal, `SurveyContext` and `survey-storage` are deleted.

Note the middleware order on that POST: `validateRebrandVote` still runs
*before* the closed-campaign check. That is what keeps a cross-site
form-encoded post failing with a 400 at the validator — the fail-closed CSRF
invariant `tests/routes/feedback-authz.test.js` guards. Putting the gate first
would retire that coverage along with the vote.

Nothing collected is deleted. `RebrandVote` rows stay, and the admin read
paths still serve the full tally and both write-in fields.

These four are the **closed vote**, not the live feedback form — that is
`POST /api/feedback` and `GET /api/feedback/mine`, documented under
[Feedback](#feedback-routesfeedbackjs) above. Both live in
`routes/feedback.js`; only the vote is retired.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/feedback/survey/status` | `{ enabled: false, concluded, decidedName, campaignId, submitted, submittedAt }` |
| `POST` | `/api/feedback/survey` | 400 on an invalid body, otherwise **410 Gone** — the vote is closed |
| `GET` | `/api/admin/rebrand/summary` | Admin-only tally by `nameChoice`, plus write-in and feature-request counts |
| `GET` | `/api/admin/rebrand` | Admin-only paginated vote list with user info and both write-in fields |

`REBRAND_NAME_ORDER` in the admin page is frozen as the order voters actually
saw; the slugs still match `REBRAND_NAME_SLUGS` in
[`validation.js`](server/middleware/validation.js), which the stored rows were
validated against. The retired SongSwipe beta survey (`BetaSignup`) and the
monetization survey before it (`SurveyResponse`) sit in the same read-only
posture.

---

## Key Features & Their Implementation

### 1. Playlist Merge with Auto-Splitting

**User-facing**: Select 2–10 playlists, optionally set a title, click Merge. Receive 1 or more new playlists (split at 500 tracks if needed).

**Frontend**: `frontend-UI/src/app/(app)/combine/page.tsx`
- Fetches user's playlists with `GET /api/playlists`
- Sends `POST /api/playlists/merge` with selected IDs

**Backend** (`server/routes/api.js` → `POST /api/playlists/merge`):
1. Fetch each source playlist via `soundcloud-client.getPlaylistWithTracks(id)` (300ms delay between calls)
2. Filter tracks: exclude `blocked_at !== null` and `streamable === false`
3. Deduplicate by track ID using a `Set`
4. Calculate split count: `Math.ceil(uniqueTracks.length / 500)`
5. For each split: create playlist with first 100 tracks → add remaining in 100-track batches (300ms delay each batch)
6. Verify final count by re-fetching created playlist

**Constants**: `BATCH_SIZE = 100`, `MAX_TRACKS = 500`

### 2. Bulk Unlike

**User-facing**: Browse liked tracks, select some or all, click Unlike. Tracks are removed from likes in batch.

**Frontend**: `frontend-UI/src/app/(app)/like-manager/page.tsx`
- Paginated via `GET /api/likes/paged?limit=50&next=<cursor>`
- Sends `POST /api/likes/tracks/bulk-unlike` with selected track IDs

**Backend**: Iterates `trackIds`, calls `soundcloud-client.unlikeTrack(id)` (DELETE `/me/likes/tracks/:id`), returns per-track status. Max 100 per request.

### 3. Likes to Playlist

**User-facing**: Select liked tracks (from paginated view), create a new playlist from them.

**Frontend**: `frontend-UI/src/app/(app)/likes-to-playlist/page.tsx`
- Same pagination as like-manager
- Sends `POST /api/playlists/from-likes` with selected track IDs and title

**Backend**: Same splitting logic as merge — creates 1–N playlists if >500 tracks selected.

### 4. URL Resolver

**User-facing**: Paste a SoundCloud URL, get back structured metadata (type, title, creator, artwork, etc.).

**Frontend**: `frontend-UI/src/app/(app)/link-resolver/page.tsx` (single) and `batch-link-resolver/page.tsx` (batch)

**Backend** (`GET|POST /api/resolve`, `POST /api/resolve/batch`):
1. Sanitize URL: parse with `new URL()`, strip `utm_*` and `si` params, validate `soundcloud.com` domain
2. Check in-memory cache (5-min TTL, keyed by sanitized URL)
3. Auth resolve: `soundcloud-client.resolveAny(url)` → handles 302 manually, refreshes on 401
4. Fallback: `soundcloud-client.resolvePublic(url)` for public resources
5. Normalize: extract `id`, `type`, `title`, `user`, `artwork_url`, `downloadable`
6. Enrich: attempt oEmbed for `thumbnail_url`

### 5. Bulk Unfollow

**User-facing**: Browse followings, select users, click Unfollow.

**Frontend**: `frontend-UI/src/app/(app)/following-manager/page.tsx`
- Fetches all followings with `GET /api/followings`
- Sends `POST /api/followings/bulk-unfollow` with selected user IDs

**Backend**: Iterates `userIds`, calls `soundcloud-client.unfollowUser(id)` (DELETE `/me/followings/:id`). Returns per-user status. Max 100 per request.

### 6. Proxy Download

**User-facing**: On any page showing downloadable tracks, click Download. Server proxies the request (attaches OAuth token) and redirects to CDN.

**Backend** (`GET /api/proxy-download?url=...`):
1. Validate URL: must match `https://api.soundcloud.com/tracks/{numeric_id}/download`
2. Call `soundcloud-client.getDownloadLink(url)` — makes authenticated SC request
3. Validate redirect URL: must point to `sndcdn.com`, `cloudfront.net`, or `soundcloud.com`
4. `res.redirect(cdnUrl)` — browser downloads directly from CDN

### 7. Activity Feed to Playlist

**User-facing**: View recent activity, select tracks, create playlist from them.

**Frontend**: `frontend-UI/src/app/(app)/activity-to-playlist/page.tsx`
- Fetches `GET /api/activities?limit=200`
- Filters client-side to only track activities
- Sends `POST /api/playlists/from-likes` with selected track IDs

### 8. Reposts Fetching (Complex Fallback Chain)

**Problem**: SoundCloud's reposts API is inconsistent between v1 and v2.

**Backend** (`GET /api/reposts`):
1. **Try V2**: `GET https://api-v2.soundcloud.com/stream/users/{userId}/reposts` with pagination (max 20 pages)
2. **If V2 returns 0**: Fall back to V1:
   - `GET /me/activities` filtered for types: `track:repost`, `track-repost`, `track_repost`, `repost`
   - `GET /me/activities/all/own` as secondary source
   - Filter to own reposts only (check `user.id === authenticatedUserId`)
3. Deduplicate by `${resourceType}:${id}` key
4. Normalize to: `{ id, urn, resourceType, title, user, artwork_url, permalink_url, created_at }`

### 9. Playlist Health Check

**User-facing**: Select a playlist, scan for blocked/unplayable tracks, optionally remove them.

**Frontend**: `frontend-UI/src/app/(app)/playlist-health-check/page.tsx`
- Fetches `GET /api/playlists/:id`
- Client-side filters for `blocked_at !== null` or `streamable === false`
- Calls `PUT /api/playlists/:id` with cleaned track list

### 10. Keyword Search & Bulk Playlist Edits

**User-facing**: Search track titles and artist names across playlists by
keyword, then remove the matches in bulk or copy them into another playlist.

**Frontend**: `frontend-UI/src/app/(app)/playlist-keyword-search/page.tsx`

**Backend**: `GET /api/playlists/search-tracks` fetches a page of playlists with
their full track lists and matches them via `lib/playlist-search.js`. A match is
one *occurrence* — `(playlistId, trackId, position)` — so the same track in
three playlists yields three rows, which is what makes "remove from everywhere"
possible, and two copies inside one playlist yield two rows. The removal path
can only name track ids (the write replaces a playlist's whole list), so the UI
selects duplicate copies as a unit and says so. Results are capped at 2,000
matches; over that the response carries `capped: true`.

`POST /api/playlists/tracks/bulk-remove` re-PUTs each playlist's surviving track
list (SoundCloud has no per-track delete). It reads every playlist first, with
`mapWithConcurrency` at `SC_READ_CONCURRENCY`, then writes sequentially with
`SC_WRITE_PACING_MS` **between** writes — not after skipped rows, failed reads,
or the last write. Per-playlist status is returned so a partial failure is
visible. `POST /api/playlists/tracks/bulk-add` appends to one target, skipping
tracks already present and stopping at 500.

**Every full-list write goes through `readPlaylistForRewrite`**
(`lib/playlist-transfer.js`). These endpoints replace a playlist's entire track
list, and `extractOrderedTrackIds` drops entries whose id is unusable — so a
read that came back short of the playlist's own `track_count` would silently
delete the difference. A mismatch throws `PlaylistReadIncompleteError`:
bulk-remove reports that playlist as an error row and continues, bulk-add and
`PUT /api/playlists/:id` return 409. Playlists with no `track_count` are not
guarded.

**Both `/api/library/audit` and `/api/playlists/search-tracks` page by `offset`
against the cached playlist list, not against SoundCloud.** `/me/playlists`
declares only `show_tracks`, `linked_partitioning` and `limit`, and marks the
shared `offset` parameter deprecated — sending one returned page 1 on every
page while the UI claimed "playlists 21-40". `lib/playlist-pages.js` slices the
list `loadCachedPlaylists` already crawls by cursor for `GET /api/playlists`, so
the order is SoundCloud's own, `total` and `hasMore` are exact, and a page walk
costs one crawl rather than one query per page. The page object also carries
`stale` and `truncated` from the cache tier, and `failed[]` names the playlists
whose track fetch did not come back.

Both routes are on `libraryReadRateLimiter` (60/hour), not
`heavyOperationRateLimiter`: they are bounded reads (≤50 SoundCloud calls per
page) and were otherwise spending the 20/hour write budget shared with merge,
clone, and every bulk write.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SOUNDCLOUD_CLIENT_ID` | Yes | OAuth app client ID |
| `SOUNDCLOUD_CLIENT_SECRET` | Yes | OAuth app client secret (never sent to browser) |
| `SOUNDCLOUD_REDIRECT_URI` | Yes | Must match the SoundCloud app registration. Production: `https://tracktoolkit.com/api/auth/callback` |
| `SESSION_SECRET` | Yes | ≥32 chars; used for HMAC-SHA256 session signing |
| `ENCRYPTION_KEY` | Yes | Exactly 32 chars; used for AES-256-GCM token encryption |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Production reads it from Key Vault `tracktoolkit-kv/database-url` (Azure Flexible Server, `?sslmode=require&connection_limit=10&pool_timeout=30`) |
| `APP_URL` | Yes | Canonical origin, and the target of the legacy-host redirects. Production: `https://tracktoolkit.com` |
| `APP_URLS` | Yes | Comma-separated CORS allowlist. Production is the single origin `https://tracktoolkit.com` — the app is same-origin, so there is nothing else to allow |
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | HTTP port (default 3001) |
| `SURVEY_ENABLED` | No | Kill switch for a **future** in-app survey. It no longer affects the rebrand name vote, which is closed in code (`REBRAND_VOTE_CONCLUDED`) and cannot be switched back on from the environment |
| `SURVEY_CAMPAIGN_ID` | No | Campaign identifier for the (closed) vote, default `2026-rebrand-name-v1`. Only the admin read paths use it now; it no longer gates any prompt |
| `GROWTH_AUTOCHECK` | No | Set to `false` to disable the daily growth follow-back scheduler |
| `ADMIN_IDS` | No | Comma-separated SoundCloud numeric user IDs allowed into `/api/admin/*`. Unset or empty = **nobody** (fails closed) |
| `SC_FETCH_TIMEOUT_MS` | No | AbortController deadline on every SoundCloud fetch (default `30000`) |
| `CHROME_EXTENSION_IDS` | No | Comma-separated extension IDs allowed as credentialed origins (CORS + `rejectUntrustedOrigin`) |
| `SESSION_COOKIE_SAMESITE` | No | `lax`, `none` or `strict` for the session cookie. Unset keeps the historical default (`none` in production). Same-origin hosting sets `lax` |
| `LEGACY_REDIRECT_HOSTS` | No | Comma-separated hostnames Express redirects to `APP_URL` (301 GET/HEAD, 308 otherwise). Unset disables the middleware |
| `RETENTION_ENABLED` | No | Set to `false` to disable the daily retention purge. **Defaults to on** — a retention policy that is off by default is not a policy |
| `RETENTION_INTERVAL_MS` | No | Sweep period (default 24h), **clamped to a 24h maximum in code** (`resolveIntervalMs`) and logged when a larger value is refused. First run is always 10 min after boot. Compliance-relevant, not a tuning knob: a longer period would eat the day of margin the 6-day disconnect window buys against the terms' 7-day deletion deadline, so it is enforced rather than documented. Lowering it is always allowed |
| `CACHE_TTL_DAYS` | No | Library-cache page/state lifetime in days (default `7`) |
| `INACTIVE_MONTHS` | No | Dormant-account window in **calendar months** (default `24`) |
| `OPLOG_RETENTION_DAYS` | No | `OperationLog` lifetime in days (default `365`) |

### Frontend (`frontend-UI/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | Dev only | API base URL for dev (e.g., `http://localhost:3001`); omit in prod for same-origin |

**Validation**: On every request in dev mode, `server/index.js` validates `ENCRYPTION_KEY` (32 chars), `SESSION_SECRET` (≥32 chars), `SOUNDCLOUD_REDIRECT_URI` (valid URL), and `DATABASE_URL` (valid DB URL).

---

## Development Commands

### Root

```bash
npm run dev          # Concurrently: frontend (port 3000) + backend (port 3001)
npm run server       # Backend only (nodemon)
npm run build        # Install all deps + build frontend + generate Prisma client
npm run build:frontend # cd frontend-UI && npm install && next build
npm test             # Jest (tests/)
```

### Database

```bash
npx prisma db push        # Apply schema changes to dev DB (no migration file)
npx prisma migrate dev    # Create and apply named migration
npx prisma generate       # Regenerate Prisma client types
npx prisma studio         # Open GUI at localhost:5555
```

### Frontend

```bash
cd frontend-UI
npm run dev          # Next.js dev server with turbopack
npm run build        # Static export → frontend-UI/out/
npm run lint         # ESLint (npx tsc --noEmit && next lint)
npm run contrast     # Colour-token gate — exits 1 if any pair is under threshold
npm run test:e2e     # Playwright against out/ — run `npm run build` first
```

The full check before claiming a change is done: `npm test` at the repo root,
then from `frontend-UI` `npm run lint`, `npm run build`, `npm run contrast`,
`npm run test:e2e`. `test:e2e` runs against `out/`, so a stale build tests
stale code.

**E2E port, and the orphan that eats an afternoon.** The harness serves
`frontend-UI/out/` on `E2E_PORT` (default 4173), and `webServer` is configured
with `reuseExistingServer: true` so a hand-started server survives a run. That
flag adopts *anything* already listening — an aborted run's leftover, or
another worktree's harness serving a different checkout's `out/`. Such a server
answers `/` with a healthy 200, so Playwright is satisfied, and the whole suite
then runs against someone else's HTML and fails in ways that describe code you
are not editing.

`e2e/global-setup.mjs` refuses to start in that case: the static server exposes
`/__e2e/identity` carrying the absolute `out/` path it is serving, and the run
aborts unless that matches this checkout. The message names the command:

```bash
lsof -nP -iTCP:$E2E_PORT -sTCP:LISTEN   # find the process holding the port
E2E_PORT=4211 npm run test:e2e          # or just use another port
```

Two checkouts running the suite at once need different `E2E_PORT` values.

---

## Patterns & Conventions

### API Response Shape

Success:
```json
{ "collection": [...], "total": 100 }     // List endpoints
{ "id": 123, "title": "..." }             // Single resource
{ "success": true }                       // Mutation confirmation
{ "playlists": [...], "stats": {...} }    // Complex operations
```

Error:
```json
{ "error": "Human-readable message" }
{ "error": "Validation failed", "details": [{ "field": "...", "message": "..." }] }
```

### UI Primitives — the sanctioned way to build a control

These are not suggestions. Every page on `feat/trust-and-mobile` was converted
to them, the axe suite passes because of them, and a hand-rolled equivalent
re-introduces the defect the primitive exists to prevent.

- **Forms use `Field`** (`components/ui/Field.tsx`) — it owns the `<label
  htmlFor>` association, the error text and the `aria-describedby` wiring.
  `Field labelHidden` when a visible label genuinely does not fit (the three
  toolbar search boxes); never a placeholder as the only label. Raw
  `<select>` → `Select`.
- **Overlays use `Dialog`** (`components/ui/Dialog.tsx`, `variant="sheet"` /
  `"drawer"`) — focus trap, Escape, focus return, `aria-modal` and an
  accessible name from the heading. `ConfirmDialog` wraps it for the
  destructive-confirm case.
- **Icon-only controls use `IconButton`** with a `label` — never a bare
  `<button>` with a glyph, and never `title` as the accessible name.
- **Announce async results with `useAnnounce`** — it writes into the single
  `LiveRegion` mounted by `AppShell`, outside `<main>` so a route change
  cannot unmount it mid-announcement. Long operations also render a
  `ProgressBar` when there is something determinate to count.
- Errors are `InlineAlert variant="error"` (already `role="alert"`); lists of
  selectable things are `SelectableRow`/`SelectableList` (a real checkbox,
  `min-w-0` on the root); page chrome is `PageContainer` + `PageHeader`, which
  owns the single `h1`.

Colours go through the HSL tokens in `globals.css` — never a raw hex (except
the brand gradient) and never an alpha-modified text colour
(`text-muted-foreground/70`); use `text-muted-foreground-subtle`. `*-text`
tokens (`primary-text`, `destructive-text`, `success-text`, `warning-text`,
`info-text`) are the ones safe for small text; the plain `--primary`,
`--destructive` and `--chart-*` are surfaces and graphics.

### Authentication Middleware Pattern

Every protected route:
```javascript
router.get('/api/endpoint',
  authenticateUser,        // Sets req.user, req.accessToken, req.refreshToken
  rateLimiter,             // Optional
  validateInput,           // express-validator rules
  async (req, res) => { ... }
);
```

### SoundCloud Client Pattern

All SC API calls go through `scRequest()` in `soundcloud-client.js`:
```javascript
await this.scRequest('/me/likes/tracks', accessToken, refreshToken, {
  method: 'GET',
  params: { limit: 50 }
});
// Auto-refreshes on 401, backs off on 429
```

### Batch Processing with Delays

Any operation that calls the SC API in a loop uses delays to avoid rate limits:
```javascript
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
for (const batch of batches) {
  await processBatch(batch);
  await sleep(300);  // 300ms between batches
}
```

### Frontend API Calls

All fetch calls use `credentials: 'include'` for cookie auth:
```typescript
const res = await fetch(`${API_BASE}/api/endpoint`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

`API_BASE` = `process.env.NEXT_PUBLIC_API_BASE || ''` (empty = same origin in prod)

### Error Sanitization

`server/middleware/rateLimiter.js` and the global error handler both strip patterns like `token=`, `secret=`, `password=`, `encryption_key=` from error messages and JSON responses before they reach the client.

### Dashboard Recent Tools

`localStorage` key `sc-toolkit-last-tools` stores an array of recently visited tool slugs. Displayed as quick-access buttons on the dashboard.

### Login Pre-warming

Before the OAuth redirect, the frontend pings `/health` (with a 1.2s timeout) to
warm the backend and reduce OAuth callback latency. It was written for a
free-tier dyno that slept; App Service has `alwaysOn`, so it now buys much
less — the timeout means it costs nothing either way, so it stays.

---

## Known Limitations & Edge Cases

1. **500-Track Playlist Cap**: SoundCloud enforces this server-side. Auto-splitting creates multiple playlists (e.g., "My Mix (1/3)"). Users must manage multiple playlists instead of one.

2. **Rate Limiting (429)**: SoundCloud's limits are undocumented. The app uses 300–500ms delays between API calls and respects `Retry-After` headers. Large bulk operations (unlike 1000+ tracks) will be slow and may still occasionally 429.

3. **Token Refresh Timing**: Tokens are only refreshed on-demand when a 401 occurs. There's no proactive refresh daemon. If a token expires mid-session, the next request triggers a refresh and retry — transparent to the user, but adds latency.

4. **Reposts API Inconsistency**: SoundCloud's V2 reposts endpoint is unreliable (sometimes returns 0 even when the user has reposts). The multi-fallback chain mitigates this but adds latency and complexity.

5. **Session cookie lifetime, not cross-origin**: the cross-site cookie
   requirement is gone — production is one origin with `SameSite=Lax; Secure`.
   What remains is that there is **no server-side session revocation list**:
   logout clears the cookie, but a previously exfiltrated cookie stays valid
   until its signed `iat` passes `SESSION_TTL_MS` (7 days). The `none` default
   in `resolveSessionSameSite` is still in the code for a split-host
   deployment, so `SESSION_COOKIE_SAMESITE=lax` is set explicitly rather than
   left implied. Local dev uses `Lax` over HTTP with the `next.config.js`
   rewrites.

6. **In-Memory URL Cache**: The `/api/resolve` cache is per-process and resets on restart. Not shared across multiple server instances. Cache TTL is 5 minutes. (The *library* cache — likes/playlists/followings/followers/reposts — is different: since the 2026-09 performance work it has a Postgres tier underneath that survives restarts. See `docs/performance-audit-2026-09.md`. Its invalidation marks are per-process, though: at `instance_count > 1` a second instance can republish a pre-mutation snapshot as `complete`, so the durable tier is only safe single-instance. See the header comment in `server/lib/social-cache.js`.)

7. **Static Export Limitation**: `next export` doesn't support Next.js API routes. All server logic must live in the Express backend. The frontend is pure client-side React.

8. **Bulk Operation Limits**: Bulk unlike and bulk unfollow are capped at 100 IDs per request (validated by middleware). Clients must chunk larger operations.

9. **SoundCloud Track Filtering**: Blocked (`blocked_at` set) and non-streamable tracks are silently excluded from merges. Users won't see an explicit count of what was filtered (only `acceptedTotal` vs `fetchedTotal` in the stats).

10. **Playlist Verification**: After creating a merged playlist, the app re-fetches it to verify the track count. If SC returns a lower count than expected (e.g., due to SC-side deduplication or delayed indexing), this is reported in stats but not retried.

---

## Deployment

### Architecture

One app, one origin. The Vercel + DigitalOcean + Neon split was retired at the
2026-09-20 cutover; `docs/internal/MIGRATION.md` is the record of it and
`infra/README.md` is the operator reference.

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend + backend | **Azure App Service** (`tracktoolkit`, Linux B1, Node 22) | One Express process serves `/api` and `frontend-UI/out/`. **`instance_count` is pinned at 1** — the library cache's invalidation marks are per-process (see `server/lib/social-cache.js`) |
| Database | **Azure Database for PostgreSQL Flexible Server** (`tracktoolkit-pg`, PG 17, Burstable B1ms) | `DATABASE_URL` comes from Key Vault `tracktoolkit-kv` |
| Secrets | **Azure Key Vault** (`tracktoolkit-kv`) | RBAC; the app reads by reference, so no secret is in the App Service config |
| Infrastructure | **Bicep** (`infra/main.bicep`, `infra/deploy.sh`) | `infra/main.cutover.bicepparam` is the live parameter set |

Retired, kept only as rollback until decommission: the DigitalOcean app
(`.do/app.yaml`), the Vercel project (`vercel.json`) and the Neon database.
None of the three is in the serving path.

### Domain Strategy

- One origin, `https://tracktoolkit.com` — the apex is canonical.
- `www.tracktoolkit.com`, `soundcloudtoolkit.com`, `www.soundcloudtoolkit.com`
  and `api.soundcloudtoolkit.com` are bound to the same app and 301/308 to the
  apex via `server/middleware/legacy-redirect.js` (`LEGACY_REDIRECT_HOSTS`).
  301 for `GET`/`HEAD`, 308 otherwise, path and query preserved.
- Session cookie is host-only and `SameSite=Lax` (`SESSION_COOKIE_SAMESITE=lax`);
  the OAuth redirect URI is `https://tracktoolkit.com/api/auth/callback`.
- Each of the five hostnames has an App Service managed certificate.

### Production Environment Differences vs Dev

| Concern | Dev | Prod |
|---------|-----|------|
| Rate limiters | Disabled | Enabled |
| Cookie `secure` | false | true |
| Cookie `sameSite` | `lax` | `lax` |
| API base URL | `http://localhost:3001` (via `NEXT_PUBLIC_API_BASE`) | Same-origin (`''`) |
| CORS | Includes localhost | `APP_URLS` — `https://tracktoolkit.com` only |
| Error messages | Sanitized but more verbose | Generic "Something went wrong" |
| Static file serving | Not used (Next.js dev server) | `frontend-UI/out/` served by Express |

### CI/CD

**`main` deploys itself.** `.github/workflows/azure-deploy.yml` runs on every
push to `main` (PR #52, 2026-09-22, which replaced DigitalOcean's
`deploy_on_push`). It builds on Linux so the Prisma engine matches the App
Service image, runs the Jest suite, builds the Next.js static export, and
ships one zip. Oryx is disabled on the app
(`SCM_DO_BUILD_DURING_DEPLOYMENT=false`), so what the workflow zips is exactly
what runs.

Two consequences worth holding onto:

- **Merging to `main` is deploying.** Anything that has to happen before the
  code runs — the two unapplied files in `docs/sql/`, an App Service setting —
  has to happen *before* the merge, not after it.
- Pushes that only touch `**.md`, `docs/**`, `infra/**`, `.gitignore` or
  `LICENSE` skip the run. Infrastructure changes go through `infra/deploy.sh`
  instead, and manual `workflow_dispatch` stays for redeploys and for
  deploying a non-`main` ref.

Auth is OIDC through the `azure` GitHub environment: `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` are repository *variables*, not
secrets — they are identifiers, and there is no long-lived credential.

`.github/workflows/keep-api-warm.yml` curls `https://tracktoolkit.com/health`
every five minutes. It existed to keep a free-tier dyno awake and is redundant
now that App Service has `alwaysOn`; it is kept as an external uptime probe
and is marked for retirement in its own header.

The frontend has no separate pipeline: it is built inside that same workflow
and served by Express. There is no Vercel deployment any more.
