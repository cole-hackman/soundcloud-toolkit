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
│   ├── index.js                  # Express app entry point; middleware stack, static serving, error handler
│   ├── routes/
│   │   └── api.js                # ALL route handlers — auth, playlists, likes, social, resolve, proxy
│   ├── lib/
│   │   └── soundcloud-client.js  # SoundCloud API wrapper — token exchange, pagination, all SC API methods
│   ├── middleware/
│   │   ├── auth.js               # authenticateUser() — session cookie → DB user → decrypted tokens
│   │   ├── validation.js         # express-validator rule sets (merge, bulk-unlike, resolve, etc.)
│   │   └── rateLimiter.js        # Four rate limiters: api, auth, heavy, health
│   ├── utils/
│   │   ├── crypto.js             # encrypt() / decrypt() using AES-256-GCM
│   │   ├── session.js            # signSession() / unsignSession() using HMAC-SHA256
│   │   └── pkce.js               # createPkcePair() — code verifier + SHA256 challenge
│   ├── prisma/
│   │   └── schema.prisma         # User + Token models
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
│   │   │   │   ├── playlist-modifier/
│   │   │   │   ├── link-resolver/
│   │   │   │   ├── batch-link-resolver/
│   │   │   │   ├── activity-to-playlist/
│   │   │   │   ├── downloads/
│   │   │   │   ├── playlist-health-check/
│   │   │   │   └── layout.tsx    # App shell with sidebar and auth guard
│   │   │   ├── login/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   ├── layout.tsx        # Root layout
│   │   │   └── page.tsx          # Landing page
│   │   ├── components/
│   │   │   ├── ui/               # shadcn-style primitive components
│   │   │   ├── AuthContext.tsx   # Auth state provider
│   │   │   ├── AppShell.tsx      # Sidebar layout wrapper
│   │   │   ├── Providers.tsx     # Context aggregator
│   │   │   └── Analytics.tsx     # Google Analytics integration
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx   # isAuthenticated, user, login(), logout()
│   │   │   └── ThemeContext.tsx
│   │   └── lib/utils.ts
│   ├── next.config.js            # Static export config, API rewrites for dev
│   ├── tailwind.config.ts
│   └── package.json
├── tests/                        # Jest tests (crypto, merge-utils, soundcloud-client)
├── prisma/
│   └── schema.prisma             # Root-level schema (may be symlinked or duplicated)
├── .do/app.yaml                  # DigitalOcean App Platform deployment config
├── package.json                  # Root scripts (dev, build, server, test)
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
   - Signs session payload `{ userId }` with HMAC-SHA256
   - Sets `session` cookie (httpOnly, secure, sameSite, 7-day)
   - Redirects to `/dashboard`

3. **Authenticated requests**: `authenticateUser` middleware (`server/middleware/auth.js`)
   - Reads `session` cookie, verifies HMAC signature
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

---

## Data Model

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
| `GET` | `/api/playlists` | User's playlists; query: `limit` (default 50), `offset` (default 0) |
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
| `GET` | `/api/reposts/debug` | Diagnostic: hits multiple SC endpoints and returns raw responses |
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

### AI Library Chat

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/library/snapshot` | Current per-user library index status (counts, freshness, `stale` flag) |
| `POST` | `/api/library/sync` | Async-trigger a full library reindex from SoundCloud. Returns `202 { status: 'syncing' }`; client polls `/library/snapshot` |
| `POST` | `/api/chat` | Streaming SSE chat. Body `{ messages: [{role, content}, ...] }`. Events: `token`, `tool_status`, `tool_result`, `done`, `error`. Tool-calling loop queries the index (with live-SC fallback). Rate-limited by `chatRateLimiter` (30/hr) |

Powered by a per-user index in Postgres (`LibrarySnapshot`, `IndexedLike`, `IndexedPlaylistTrack`) populated by `server/lib/library-index.js#syncLibrary`. Tools are defined in `server/lib/chat-tools.js` and dispatched by `server/routes/chat.js`. OpenAI access is isolated in `server/lib/chat-provider.js` so the provider is swappable.

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
| `OPENAI_API_KEY` | Chat only | Server-only OpenAI key powering the AI Library Chat |
| `CHAT_MODEL_REASONING` | No | OpenAI model used by the chat tool-calling loop (default `gpt-4o-mini`) |
| `CHAT_MODEL_SIMPLE` | No | Reserved for future cheap-model routing |

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
