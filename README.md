# SoundCloud Toolkit

Bulk library management for SoundCloud power users — the batch operations the
official site makes you do one click at a time.

**3,155 registered users · 1,216 active in the last 90 days · 1,125,105 tracks
processed all-time** (as of August 2026)

Live at [soundcloudtoolkit.com](https://soundcloudtoolkit.com).

<!-- SCREENSHOT: dashboard after login, showing the tool grid grouped as
Playlists / Likes & Social / Library & Export / Discovery & Links. A ~10s GIF
of a playlist merge completing (select playlists → merge → numbered output)
would do even more work here. Keep under 5MB. -->

## The problem

SoundCloud's site operates one item at a time. Unliking a track is one click;
so is unfollowing an account or removing a repost. Playlists hard-cap at 500
tracks, and dead tracks — private, DMCA'd, region-blocked — sit in playlists
silently. For DJs and collectors with libraries in the thousands, cleanup was
effectively impossible. The toolkit runs those operations in batches through
SoundCloud's OAuth API, and splits playlist output into numbered parts when it
hits the cap.

<!-- TODO: verify — one line on how the problem was discovered (own workflow?
user conversations? forum threads?). See README-QUESTIONS.md. -->

## How it works

Twenty tools hang off one dashboard, grouped as Playlists, Likes & Social,
Library & Export, and Discovery & Links. Underneath them:

- The frontend is a Next.js static export on Vercel. The backend is an Express
  app on DigitalOcean acting as an OAuth2 + PKCE proxy: the browser never sees
  SoundCloud tokens. Tokens are AES-256-GCM-encrypted at rest in Postgres, and
  every SoundCloud call is made server-side with the user's decrypted token.
- A request flows: HMAC-signed session cookie → user and token lookup → the
  SoundCloud client wrapper → SoundCloud's API, with automatic token refresh
  on 401 and backoff on 429.
- Bulk writes run sequentially in 100-track batches with ~300 ms delays.
  Merges dedupe by track ID, filter out blocked and non-streamable tracks, and
  split into numbered playlists at SoundCloud's 500-track cap.
- State lives in Postgres (Neon): users, encrypted tokens, a per-operation
  log, and follow-action history. URL-resolve caching and background-job
  tracking are in-memory, per-process.
- Rate limiting is the most common failure point — SoundCloud's limits are
  undocumented.

## Running it

Requires Node 18+, a Postgres database (Neon works), and a SoundCloud OAuth
app (client ID and secret from developers.soundcloud.com).

    git clone https://github.com/cole-hackman/soundcloud-toolkit
    cd soundcloud-toolkit
    npm install
    cp .env.example .env   # SoundCloud credentials, DATABASE_URL, generated secrets
    npx prisma db push     # create the schema
    npm run dev            # frontend on :3000, API on :3001

There is no mock mode: without real SoundCloud credentials and a database the
app does not run. Rate limiters are disabled in development.

## Scope and non-goals

**In scope:** batch operations on your own library — playlists, likes,
followings, reposts — plus browsing and cloning public content from accounts
you already follow.

**Not in scope:**

- Downloading tracks that aren't download-enabled. The download proxy accepts
  only SoundCloud's official per-track download endpoint and only redirects to
  SoundCloud's own CDNs.
- Follow automation. The discovery tool enforces hard server-side caps — 50
  follows per 24 hours with cooldowns — no matter what the client requests.
- Multi-account management.

## Tradeoffs

**Static-export frontend with a separate Express API.** Vercel serves the
frontend as static files; the API runs on a $5/month DigitalOcean instance.
What it bought: near-zero hosting cost and no server rendering to operate.
What it cost: Next.js API routes are unavailable (all server logic lives in
Express), and sessions ride cross-site cookies — `SameSite=None` across the
`www.` and `api.` subdomains with a strict CORS allowlist. Getting those
cookies right was the most fragile part of the deployment.

**Server-enforced caps on the follow/discovery tool.** SoundCloud flags
aggressive follow activity. The caps live in the backend — 50 follows per 24
hours, 30-minute session cooldowns, 2–5 second jittered pacing between
follows — and reversing a follow doesn't refund the budget, because the write
still happened on SoundCloud's side. What it bought: users can't burn their
accounts by hammering the tool. What it cost: the feature is deliberately
slow, and that's the predictable complaint.

## Known limitations and failure modes

- SoundCloud's rate limits are undocumented. Requests back off on 429 and
  respect `Retry-After`, but bulk operations over a few hundred items still
  occasionally get throttled — and they're slow by design.
- Merges silently drop blocked and non-streamable tracks. The API response
  includes the counts, but the UI doesn't itemize what was filtered. Silent
  from the user's perspective.
- SoundCloud's v2 reposts endpoint sometimes returns zero for users who have
  reposts. A v1 fallback chain mitigates this at the cost of latency, and can
  still miss items.
- In-memory state (the resolve cache, the follow-job registry) is per-process
  and assumes the single-instance deploy. A restart loses running job state; a
  second instance would fork it.
- Schema management mixes `prisma db push` with migration files. A push from a
  branch whose schema is missing production tables would drop those tables —
  the sharpest foot-gun in the repo.
- Observability is application logs plus the in-database operation log. No
  metrics, no alerting, no error tracker. The only scheduled automation is a
  GitHub Actions cron pinging `/health` every five minutes.
- 110 unit tests across 14 suites pass locally (crypto, merge logic,
  validation, the follow engine, the API client wrapper), but no CI runs them
  on push, and the frontend has no tests.

## What I'd do next

1. Surface what a merge filtered out. The counts already come back in the API
   response; the UI drops them on the floor.
2. Wire the existing Jest suite into CI — the tests exist, nothing runs them.
3. Move background-job state from memory into Postgres so a restart doesn't
   orphan running follow sessions.
4. Finish the AI library chat on `feature/ai-library-chat` — the index tables
   are already in the production schema; the tool-calling chat loop isn't
   merged.

## Stack

Next.js 15 · React 18 · TypeScript · Tailwind CSS · Express · Prisma ·
PostgreSQL (Neon) · Vercel · DigitalOcean
