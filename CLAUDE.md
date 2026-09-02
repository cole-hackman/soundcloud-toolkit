# CLAUDE.md — SoundCloud Toolkit Project Brief

## Project Overview

SoundCloud Toolkit is a full-stack web application for SoundCloud power users who need bulk management capabilities the official platform doesn't provide. It solves the 500-track playlist limit with automatic playlist splitting, enables batch operations (bulk unlike, bulk unfollow, bulk repost removal, playlist merging), converts liked tracks or activity feeds into playlists, resolves SoundCloud URLs to structured metadata, and provides a playlist health checker. The backend acts as a secure OAuth2 proxy—all SoundCloud API calls flow through it so credentials never reach the browser.

---

## Tech Stack

### Backend (`server/`)
- **Node.js** with **Express.js** — HTTP server, routing, middleware
- **Prisma ORM** with **PostgreSQL** (Neon recommended) — data persistence
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
- **Next.js 15** (React 18) — app router, static export (`output: 'export'`)
- **TypeScript**
- **Tailwind CSS v4** — utility styling
- **shadcn/ui** (custom components in `src/components/ui/`) — Button, Card, Input, LoadingSpinner, EmptyState, Skeleton
- **Space Grotesk** + **Plus Jakarta Sans** — fonts via `next/font`
- Deployed as static export on **Vercel**

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
│   │   ├── auth.js               # OAuth2+PKCE login/callback, session /me, logout, account deletion
│   │   └── feedback.js           # Rebrand name vote — status + submit
│   ├── lib/
│   │   ├── soundcloud-client.js  # SoundCloud API wrapper — token exchange, pagination, 401 refresh, 429 backoff, 30s fetch timeout
│   │   ├── session.js            # signSession/unsignSession (HMAC-SHA256, timing-safe), parseSessionData (iat/TTL), SESSION_TTL_MS
│   │   ├── crypto.js             # encrypt() / decrypt() using AES-256-GCM
│   │   ├── pkce.js               # createPkcePair() — code verifier + SHA256 challenge
│   │   ├── prisma.js             # Prisma singleton + transient-connection retry extension (Neon idle drops)
│   │   ├── logger.js             # Sanitizing logger — redacts secrets in messages AND data, all levels
│   │   ├── safe-error.js         # Client-safe error payload builder
│   │   ├── analytics.js          # logOperation() → OperationLog; operation timers, client info
│   │   ├── normalize.js          # Pure resource normalizers (track/playlist/user, library-browser shapes)
│   │   ├── pacing.js             # Shared sleep() + SC_WRITE_PACING_MS (300ms) — the single source for write pacing
│   │   ├── resolve-cache.js      # In-memory /api/resolve cache (5-min TTL, 1000-entry cap)
│   │   ├── social-cache.js       # Per-user cached followings/followers/likes/playlists payloads + invalidation
│   │   ├── request-cache.js      # Generic namespaced per-user TTL cache backing social-cache
│   │   ├── merge-utils.js        # Dedup + 500-track chunking for merge/from-likes
│   │   ├── playlist-transfer.js  # Move/duplicate a track between playlists
│   │   ├── playlist-compare.js   # Diff two playlists
│   │   ├── library-audit.js      # Blocked/non-streamable summary across the library
│   │   ├── dashboard-summary.js  # Dashboard aggregate payload
│   │   ├── catalog.js            # Music-catalog harvest/upsert (Track, Playlist tables)
│   │   ├── enrichment.js         # Piggybacked track metadata backfill
│   │   ├── download-utils.js     # Download URL + CDN redirect allowlists
│   │   ├── growth-engine.js      # Discovery scoring, follow budget, background engagement jobs
│   │   ├── growth-scheduler.js   # Daily follow-back check scheduler (GROWTH_AUTOCHECK)
│   │   └── token-context.js      # AsyncLocalStorage token context for refresh propagation
│   ├── middleware/
│   │   ├── auth.js               # authenticateUser() — session cookie → DB user → decrypted tokens
│   │   ├── adminAuth.js          # adminAuth() — req.user.soundcloudId ∈ ADMIN_IDS; fails closed when unset
│   │   ├── security.js           # securityHeaders, preventKeyLeakage, validateEnv, rejectUntrustedOrigin
│   │   ├── validation.js         # express-validator rule sets (merge, bulk-unlike, resolve, growth, survey, etc.)
│   │   └── rateLimiter.js        # Four rate limiters: api, auth, heavy, health
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
│   │   │   │   └── layout.tsx    # App shell with sidebar and auth guard
│   │   │   ├── login/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   ├── layout.tsx        # Root layout
│   │   │   └── page.tsx          # Landing page
│   │   ├── components/
│   │   │   ├── ui/               # shadcn-style primitive components
│   │   │   ├── AppShell.tsx      # Sidebar layout wrapper
│   │   │   ├── RebrandSurveyModal.tsx # Rebrand name-vote modal
│   │   │   ├── Providers.tsx     # Context aggregator
│   │   │   └── Analytics.tsx     # Google Analytics integration
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx   # isAuthenticated, user, login(), logout()
│   │   │   ├── SurveyContext.tsx # Survey gating (server truth + 14-day cooldown)
│   │   │   └── ThemeContext.tsx
│   │   └── lib/utils.ts
│   ├── next.config.js            # Static export config, API rewrites for dev
│   ├── tailwind.config.ts
│   └── package.json
├── tests/                        # Jest suites — lib units plus tests/routes/ (supertest authz/CSRF boundaries)
├── prisma/
│   └── schema.prisma             # Single source of truth for the schema (13 models)
├── docs/                         # Engineering review, SECURITY.md, plans, incident notes, api.json
├── .do/app.yaml                  # DigitalOcean App Platform deployment config
├── package.json                  # Root scripts (dev, build, server, test)
├── STATE.md                      # Session state + decision log (read this first)
└── CLAUDE.md                     # This file
```


---

## Architecture

### Request Flow

```
Browser ──HTTPS──▶ Vercel (Next.js static)
                        │
                        │  fetch('/api/...', { credentials: 'include' })
                        │
                        ▼
              Express Backend (DigitalOcean / Render / Railway)
                        │
                 [authenticateUser middleware]
                 Session cookie ──▶ DB lookup ──▶ decrypt tokens
                        │
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
| `sameSite` | `lax` | `none` |
| `domain` | (none) | `.soundcloudtoolkit.com` |
| `maxAge` | 7 days | 7 days |

`SameSite=None` is required in production because the frontend (Vercel) and backend (DigitalOcean) are on different subdomains.

### CSRF & Origin Enforcement

Because production cookies are `SameSite=None`, CSRF is handled in two layers:

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

The schema (`prisma/schema.prisma`) has **13 models**, not two:

| Model | Purpose |
|-------|---------|
| `User` | One row per SoundCloud account that has logged in |
| `Token` | AES-256-GCM-encrypted access + refresh token pair (one per user) |
| `OperationLog` | Per-operation analytics record — action, status, duration, track/playlist ids |
| `Track` / `Playlist` | Harvested music catalog (populated opportunistically from resolved/browsed content) |
| `GrowthAction` | Follow/like actions taken by the growth suite, plus follow-back outcomes |
| `RebrandVote` | Rebrand name-vote responses — the live survey (`@@unique([userId, campaignId])`) |
| `BetaSignup` | The retired SongSwipe beta survey — retained read-only for history |
| `SurveyResponse` | The retired monetization survey — retained read-only for history |
| `chat_conversations` / `chat_messages` | AI library chat (owned by `feature/ai-library-chat`; declared here so `prisma db push` does not drop them) |
| `indexed_likes` / `indexed_playlist_tracks` / `library_snapshots` | Library indexing for that same feature — same db-push caveat |

The two models this app touches on every request are detailed below.

### `User` (`users` table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) | Internal primary key |
| `soundcloudId` | `Int` (unique) | SoundCloud numeric user ID — used for OAuth upsert |
| `username` | `String` | SC username (URL slug) |
| `displayName` | `String?` | Display name (may differ from username) |
| `avatarUrl` | `String?` | Profile picture URL |
| `createdAt` | `DateTime` | Auto |
| `updatedAt` | `DateTime` | Auto |
| `tokens` | `Token[]` | One-to-many relation (effectively one per user) |

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

Rate limited: `authRateLimiter` (5 requests / 15 min)

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
| `GET` | `/api/likes/paged` | Single page of likes; query: `limit` (default 50), `next` (cursor URL from prev response); returns `{ collection, next_href }` |
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
| `PUT` | `/api/playlists/:id` | `{ tracks: number[], title?: string }` | Update playlist track order / title |

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
| `GET` | `/api/library/audit` | Blocked / non-streamable summary across the user's library |
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
| `GET` | `/api/admin/rebrand/summary` | Rebrand name-vote tally + write-in counts |
| `GET` | `/api/admin/rebrand` | Rebrand vote list (write-in names, feature requests) |
| `GET` | `/api/admin/feedback/summary` | Retired beta-survey aggregates (API only) |
| `GET` | `/api/admin/feedback` | Retired beta-survey response list (API only) |
| `GET` | `/api/admin/feedback/beta-emails` | CSV export of beta opt-in emails (API only) |

The three `/feedback/*` routes serve the retired SongSwipe beta survey. They
still work, but nothing calls them — the admin dashboard shows only the live
rebrand vote. Reach them by URL when the historical data or the beta invite
list is wanted.

### Account

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/api/auth/account` | Delete the account and cascade-delete all owned rows |

> `docs/api.json` is the machine-readable inventory. It is generated, not
> hand-maintained — re-check it against `grep -n "router\." server/routes/*.js`
> before trusting it.

### Feedback Survey (rebrand name vote)

The survey infrastructure now runs the **rebrand name vote**. SoundCloud's API
Terms of Use forbid "SoundCloud" in an app's name *or* its domain, so the
product has to rename; this survey shows every logged-in user the ranked
shortlist and collects a vote plus two optional write-ins.

It replaced the SongSwipe beta survey, which replaced the monetization survey
before that. Both predecessors (`BetaSignup`, `SurveyResponse`) are retained
read-only for history — their admin read endpoints still work, their write
paths and modals are gone.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/feedback/survey/status` | `{ enabled, campaignId, submitted, submittedAt }` for the current user / active campaign |
| `POST` | `/api/feedback/survey` | Submit a vote: `{ nameChoice, nameIdea?, featureIdea?, context }`; 409 if already submitted for the campaign |
| `GET` | `/api/admin/rebrand/summary` | Admin-only tally by `nameChoice`, plus write-in and feature-request counts |
| `GET` | `/api/admin/rebrand` | Admin-only paginated vote list with user info and both write-in fields |

`nameChoice` is one of the shortlist slugs — `tracktidy`, `tracktoolkit`,
`deckdig`, `sortwave`, `deckhaul` — or `none`. The list is defined in
three places that must stay in sync: `REBRAND_NAME_SLUGS`
([`validation.js`](server/middleware/validation.js)), `NAME_OPTIONS`
([`RebrandSurveyModal.tsx`](frontend-UI/src/components/RebrandSurveyModal.tsx)),
and `REBRAND_NAME_ORDER` in the admin page.

Responses live in the `RebrandVote` table (`@@unique([userId, campaignId])`),
linked to `userId` + snapshotted `soundcloudId`.

**The modal is mandatory.** There is no close button, no Escape, no backdrop
dismiss and no snooze — submitting a vote is the only way past it, and `none`
("None of these") is the pressure valve. The single exception is a failed
submit: once `errorMessage` is set the modal offers "Skip for now", so a
backend outage cannot lock users out of the app. That escape records nothing,
so the prompt returns on the next navigation.

Because of that, [`SurveyContext.tsx`](frontend-UI/src/contexts/SurveyContext.tsx)
gates on **only** the kill switch and whether the user has already voted
(server truth plus a localStorage mirror). Snooze, don't-show-again and the
re-prompt cooldown were removed — honouring a stale dismissal would let anyone
who dismissed an earlier build skip the vote forever. There is also no
qualifier gate and no heavy-user carve-out; every authenticated user is in
scope.

Option order in the modal is Cole's preference (TrackTidy and Track Toolkit
first), not the research ranking. First position attracts votes, so read the
gap between the top two and the rest as soft. Triggers fire on the dashboard, post-merge
success, and post-likes-to-playlist success. Default campaign is
`2026-rebrand-name-v1`.

Because localStorage keys are namespaced by campaign id, a stale
`SURVEY_CAMPAIGN_ID` in the environment would carry the previous survey's
snooze / don't-show-again state over. **Unset it (or set it to
`2026-rebrand-name-v1`) when deploying this survey.**

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

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SOUNDCLOUD_CLIENT_ID` | Yes | OAuth app client ID |
| `SOUNDCLOUD_CLIENT_SECRET` | Yes | OAuth app client secret (never sent to browser) |
| `SOUNDCLOUD_REDIRECT_URI` | Yes | Must match app registration (e.g., `https://api.soundcloudtoolkit.com/api/auth/callback`) |
| `SESSION_SECRET` | Yes | ≥32 chars; used for HMAC-SHA256 session signing |
| `ENCRYPTION_KEY` | Yes | Exactly 32 chars; used for AES-256-GCM token encryption |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_URL` | Yes | Primary frontend origin (e.g., `https://www.soundcloudtoolkit.com`) |
| `APP_URLS` | Yes | Comma-separated CORS allowlist (e.g., `https://www.soundcloudtoolkit.com,https://api.soundcloudtoolkit.com`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | No | HTTP port (default 3001) |
| `SURVEY_ENABLED` | No | Kill switch for the in-app feedback survey (`true` by default; set to `false` to disable globally without a redeploy) |
| `SURVEY_CAMPAIGN_ID` | No | Active survey campaign identifier (default `2026-rebrand-name-v1`). Bumping this opens a new campaign so previously-submitted users see the prompt again |
| `GROWTH_AUTOCHECK` | No | Set to `false` to disable the daily growth follow-back scheduler |
| `ADMIN_IDS` | No | Comma-separated SoundCloud numeric user IDs allowed into `/api/admin/*`. Unset or empty = **nobody** (fails closed) |
| `SC_FETCH_TIMEOUT_MS` | No | AbortController deadline on every SoundCloud fetch (default `30000`) |
| `CHROME_EXTENSION_IDS` | No | Comma-separated extension IDs allowed as credentialed origins (CORS + `rejectUntrustedOrigin`) |

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
npm run lint         # ESLint
```

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

Before the OAuth redirect, the frontend pings `/health` (with 1.2s timeout) to wake up a cold-start serverless backend and reduce OAuth callback latency.

---

## Known Limitations & Edge Cases

1. **500-Track Playlist Cap**: SoundCloud enforces this server-side. Auto-splitting creates multiple playlists (e.g., "My Mix (1/3)"). Users must manage multiple playlists instead of one.

2. **Rate Limiting (429)**: SoundCloud's limits are undocumented. The app uses 300–500ms delays between API calls and respects `Retry-After` headers. Large bulk operations (unlike 1000+ tracks) will be slow and may still occasionally 429.

3. **Token Refresh Timing**: Tokens are only refreshed on-demand when a 401 occurs. There's no proactive refresh daemon. If a token expires mid-session, the next request triggers a refresh and retry — transparent to the user, but adds latency.

4. **Reposts API Inconsistency**: SoundCloud's V2 reposts endpoint is unreliable (sometimes returns 0 even when the user has reposts). The multi-fallback chain mitigates this but adds latency and complexity.

5. **Cross-Origin Cookie Requirement**: Production uses `SameSite=None; Secure` cookies. This requires HTTPS on both frontend and backend. Local dev with HTTP uses `SameSite=Lax` and same-origin rewrites in `next.config.js`.

6. **In-Memory URL Cache**: The resolve endpoint cache is per-process and resets on restart. Not shared across multiple server instances. Cache TTL is 5 minutes.

7. **Static Export Limitation**: `next export` doesn't support Next.js API routes. All server logic must live in the Express backend. The frontend is pure client-side React.

8. **Bulk Operation Limits**: Bulk unlike and bulk unfollow are capped at 100 IDs per request (validated by middleware). Clients must chunk larger operations.

9. **SoundCloud Track Filtering**: Blocked (`blocked_at` set) and non-streamable tracks are silently excluded from merges. Users won't see an explicit count of what was filtered (only `acceptedTotal` vs `fetchedTotal` in the stats).

10. **Playlist Verification**: After creating a merged playlist, the app re-fetches it to verify the track count. If SC returns a lower count than expected (e.g., due to SC-side deduplication or delayed indexing), this is reported in stats but not retried.

---

## Deployment

### Architecture

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | **Vercel** | Auto-deploys from git; static export |
| Backend | **DigitalOcean App Platform** (`.do/app.yaml` included) or Render/Railway/Fly.io | Node.js; set all env vars in platform dashboard |
| Database | **Neon** PostgreSQL | Serverless pooling; use `DATABASE_URL` from Neon console |

### Domain Strategy

- Frontend: `https://www.soundcloudtoolkit.com` → Vercel
- Backend: `https://api.soundcloudtoolkit.com` → DigitalOcean
- Session cookies use `Domain=.soundcloudtoolkit.com` (apex) to be shared across subdomains

### Production Environment Differences vs Dev

| Concern | Dev | Prod |
|---------|-----|------|
| Rate limiters | Disabled | Enabled |
| Cookie `secure` | false | true |
| Cookie `sameSite` | `lax` | `none` |
| API base URL | `http://localhost:3001` (via `NEXT_PUBLIC_API_BASE`) | Same-origin (`''`) |
| CORS | Includes localhost | Strict subdomain allowlist |
| Error messages | Sanitized but more verbose | Generic "Something went wrong" |
| Static file serving | Not used (Next.js dev server) | `frontend-UI/out/` served by Express |

### DigitalOcean Config (`.do/app.yaml`)

Defines the service with build command (`npm run build`), run command (`npm run server`), and environment variable references. Adjust `instance_size` and `instance_count` for scale.

### CI/CD

No automated CI/CD pipeline is configured. Deployments are manual pushes to the platform (DigitalOcean/Render) or via Vercel's git integration for the frontend.
