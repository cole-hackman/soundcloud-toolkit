# SoundCloud Feature Expansion Plan

*Prepared 2026-08-10 · Based on the official OpenAPI spec (github.com/soundcloud/api, last
updated 2026-07-19), the API release changelog, and the current codebase.*

## TL;DR

The official API grew significantly in 2026 and now covers things we currently hack around
or don't offer at all: **official repost listing** (`GET /me/reposts/*`, March 2026),
**repost creation**, **follow creation**, **playlist likes**, **recently played**,
**related tracks/artists**, **track upload & metadata editing**, **comment posting**,
and **BPM/genre/duration search filters**. Before building anything new, there is a
**Priority 0 compliance track**: our reposts feature and parts of growth ride on
`api-v2.soundcloud.com`, which is unofficial and a direct API-ToS breach — and SoundCloud
demonstrated in June 2026 (Hypeddit cutoff) that it will sever apps it dislikes. The new
official endpoints let us delete that risk entirely.

---

## Priority 0 — Compliance & platform-risk hardening (do before new features)

These protect the app's existence. SoundCloud's enforcement pattern in 2026: revoke
client credentials (Hypeddit lost API access in June 2026; unused/violating keys get
revoked; re-registering to circumvent is itself prohibited, and registration policy is
now one app per person).

1. **Replace the reposts fallback chain with `GET /me/reposts/tracks` + `GET /me/reposts/playlists`**
   (added March 2026). This deletes the api-v2 usage and the V1-activities heuristics in
   `GET /api/reposts` — our single biggest ToS exposure and our most complex code path.
   Audit the growth engine (`/users/:userUrn/related` etc.) for any remaining api-v2
   calls and move them to the official `GET /users/{urn}/related` (May 2026) and
   `GET /tracks/{urn}/related`.
2. **Migrate `/me/activities*` → `GET /me/feed` / `GET /me/feed/tracks`.** The activities
   endpoints are formally deprecated in the spec; feed items now include a `reposter`
   field. Affects `/api/activities` and activity-to-playlist.
3. **URN migration.** Numeric IDs in paths are deprecated since April 2025 (e.g.
   `soundcloud:tracks:123` instead of `123`). Our client uses numeric IDs throughout.
   Add URN support in `soundcloud-client.js` centrally (accept both, emit URNs).
4. **Streaming fields**: `http_mp3_128_url` is deprecated (AAC HLS only since 2026);
   anywhere we surface stream/preview URLs should use `hls_aac_160_url` /
   `/tracks/{urn}/streams`.
5. **Watch item**: `DELETE /reposts/tracks/{urn}` is marked deprecated in the current
   spec with no documented replacement. Bulk repost-removal depends on this — track the
   changelog and file/watch an issue on soundcloud/api.
6. **Do not build engagement-coercion features** (download gates, follow-for-X). That's
   the exact category SoundCloud just killed ecosystem-wide. Management tools are
   tolerated; growth-hacking tools are being executed. Keep the growth engine
   conservative (it already has server-side caps — good).

*Also worth knowing: rate limits are mostly undocumented (429 + backoff), access tokens
are ~1h with single-use refresh tokens, and there are no granular OAuth scopes — a token
is all-or-nothing, which is worth a line in the privacy policy.*

## Tier 1 — High-value features unlocked by 2026 API additions

### 1. Repost Manager v2: create, schedule, curate
We only *remove* reposts today. `POST /reposts/tracks/{urn}` and
`POST /reposts/playlists/{urn}` are official.
- **Bulk repost**: repost every track in a playlist / all selected likes.
- **Repost scheduler**: queue reposts at chosen times (needs a small job runner — we
  already have a daily growth scheduler to hang it on). Positioning: artists repost
  their own back catalog on a cadence; curators stagger reposts instead of flooding
  followers. Keep per-day caps to stay in "management" territory.
- **Repost cycling**: un-repost + re-repost own tracks to resurface them (bounded,
  opt-in, capped — see the coercion warning above; cycling is borderline, cap it hard
  or skip if uncomfortable).

### 2. Playlist Like Manager
We manage track likes only. `GET /me/likes/playlists`, `POST/DELETE /likes/playlists/{urn}`
enable a parallel tool for liked playlists: browse, bulk-unlike, and "clone a liked
playlist into my account" (pairs with the existing playlist-cloner).

### 3. Recently Played → Playlist
`GET /me/recently-played/tracks` (June 2026, last 25 tracks) — the `/recently-played`
page already exists in the app; add one-click "save session to playlist" and an optional
history accumulator: poll while the user has the app open (or on each visit), persist
into `indexed_*`-style tables, and over time offer "your real listening history →
playlist", which SoundCloud itself doesn't offer. Clear disclosure required since we'd
be storing listening history server-side.

### 4. Discovery & playlist extension
`GET /tracks/{urn}/related` + `GET /users/{urn}/related`:
- **"Extend this playlist"**: suggest N related tracks for an existing playlist
  (per-track related, deduped against the playlist + user's likes).
- **"More like this artist"** panel in genre-search/following tools.
- Feeds the growth engine's genre-affinity scoring with official data.

### 5. DJ crate-digging search
`GET /tracks` supports `bpm[from/to]`, `duration`, `genres`, `tags`, `created_at` ranges,
and track objects expose `bpm` and `key_signature`. Build an advanced search the SC UI
doesn't have: "128–130 BPM tech-house uploaded this month, 5–8 minutes." This is a
DJ-native feature no competitor offers, aligns with the SongSwipe/Rekordbox audience,
and is read-only (zero platform risk). The existing genre-search page is the natural home.

### 6. Follow-back and following hygiene (fully official now)
`PUT /me/followings/{urn}` (with 422 reason messages since July 2026) + followers/followings
listings: non-reciprocal follow detection ("who doesn't follow me back"), follow-back
queue for followers you don't follow, one-click unfollow of inactive accounts (last
upload > N years via `/users/{urn}/tracks?sort=desc`). The following-library page and
growth engine already have most of the UI/data plumbing.

## Tier 2 — Artist-side toolkit (new audience segment)

Today the app serves *listeners/curators*. The API's write surface enables an artist tab:

1. **Bulk track metadata editor** — `PUT /tracks/{urn}`: edit genre/tags/descriptions/
   license/purchase links across many tracks at once (spreadsheet-style grid). Artists
   with big back catalogs have no native way to do this.
2. **Quiet-mode toggler** — `reveal_stats` / `reveal_comments` (March 2026) in bulk.
3. **Storefront manager** — `PUT /tracks/{urn}/storefront` (July 2026): set "buy" modules
   (Bandcamp/vinyl links) across a catalog. Note: requires creator subscription on the
   artist's side, and the endpoint currently has a reported 500 bug (soundcloud/api #560) —
   build behind a flag.
4. **Uploader with templates** — `POST /tracks` (multipart, ~500MB cap): upload with
   saved tag/description/license templates, ISRC field, release scheduling via
   `release_date`. Lower priority: uploading via web UI is already decent; the template
   value is for frequent uploaders.
5. **Comment tools** — `POST /tracks/{urn}/comments` exists (timestamped), but there's
   **no comment delete/edit** in the public API, so a "comment manager" can't be built;
   limit to e.g. "thank new reposters" — and even that flirts with auto-engagement.
   Recommend: skip automated commenting entirely (spam-bot territory).

## Tier 3 — Data & insight features (read-only, low risk, high shareability)

1. **Library insights / "Wrapped"** — top liked artists, genre breakdown, like velocity,
   oldest like; renders the shareable cards specified in the social/UGC plan. Data:
   existing `indexed_likes`/likes endpoints + `favoriters`/`reposters` counts.
2. **Playlist analytics** — for own playlists: `GET /playlists/{urn}/reposters`,
   per-track `favoriters`/`reposters`/`download_count`; "which tracks in my playlist are
   dying" (blocked/preview via `access` field — also improves health-check accuracy:
   use `access` instead of inferring from `blocked_at`/`streamable`).
3. **Follower audit** — follower quality snapshot over time using `library_snapshots`
   pattern: growth curve, churn, ghost followers (no uploads, no likes).
4. **Batch hydration** — `GET /tracks?urns=...` (fixed March 2026) to hydrate many
   tracks in one call; speeds up health-check, resolver, and playlist-compare
   dramatically vs. per-track fetches.

## What we cannot build (API gaps, so don't promise)

- Play-count analytics/charts over time (no stats API; issue closed as unavailable),
  notifications, DMs, comment deletion, playlist-follow, Go+ full-length streaming
  (DRM), user top-tracks (open feature request).

## Suggested sequencing

| Phase | Items | Effort |
|---|---|---|
| 0 (now) | Reposts→official endpoints, activities→feed, api-v2 audit | ~1 wk |
| 1 | URN migration in client; batch hydration; health-check via `access` | ~1 wk |
| 2 | Playlist like manager; recently-played→playlist; follow-back hygiene | 1–2 wk |
| 3 | DJ crate-digging search; "extend this playlist" discovery | 1–2 wk |
| 4 | Repost manager v2 (bulk + scheduler) | 1–2 wk |
| 5 | Library insights/Wrapped cards (joint with social plan) | 1 wk |
| 6 | Artist toolkit (metadata editor first) | 2–3 wk |

Phases 0–1 are invisible to users but are the ones that keep the product alive; 2–5 are
the visible wins; 6 opens a second audience.
