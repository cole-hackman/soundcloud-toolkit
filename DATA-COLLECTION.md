# DATA-COLLECTION.md — Music Dataset Spec for SC Toolkit

**Date:** 2026-08-09 · **Status: SPEC ONLY — nothing here is implemented.** Awaiting approval.
**Goal:** persist the track and playlist identity behind every operation so an admin can explore what music moves through the tool.

**Verification note:** every count below was computed from the production exports or read from the code during this session. Claims from subagent traces that carried risk (the clone bug, the playlist-compare bug, the analytics merge/cap logic) were re-verified directly against the source. Anything not verified is labeled as such.

---

## 0. Two live bugs found during the audit (fix before or with any of this)

These are not spec items — they're regressions the audit tripped over, verified in code and corroborated by the export. Left unfixed per your "don't implement" instruction.

1. **Clone is broken in production since the Aug 6 deploy.** All four clone logging references use `source.id` (`server/routes/api.js:645, 649, 688, 692`) but no `source` variable exists — the route defines `resource` (`:558`) and `sourceId` (`:573`). The ReferenceError fires *after* the playlist is created on SoundCloud, inside the route's try, so every clone **succeeds upstream but returns a 500 to the user**, skips cache invalidation, and logs nothing. Export corroboration: clone averaged ~4 rows/day for months (461 rows), last row 2026-08-05, zero rows after the deploy. Fix: `sourceId` at 645/649, and `sourceId` / `newPlaylist.id` at 688/692.
2. **playlist-compare metadata logs undefined.** The log site reads `comparison.summary.commonTrackCount` / `.playlistA.uniqueCount` / `.playlistB.uniqueCount` (`api.js:500-502`), but the library returns `overlapCount` / `uniqueToACount` / `uniqueToBCount` (`server/lib/playlist-compare.js:52-54`). All three serialize away; the export's playlist-compare rows contain only `playlistIds`.

Related data finding, same family: **bulk-like failures are invisible.** On Aug 7 one user ran 13 batches; after the first two, every batch succeeded on 0 of ~100 items — all logged `status: 'success'` (hardcoded, `api.js:2297-2304`). ~900 likes silently didn't happen. Same window as the bulk-unlike/unfollow failure bursts in ANALYSIS.md §5.1.

---

## Part 1 — What's stored today

### 1.1 Tables (from `prisma/schema.prisma`, the only schema — the `server/prisma/` copy mentioned in CLAUDE.md doesn't exist)

| Table | Written by | Notes |
|---|---|---|
| `users` | OAuth callback upsert (`auth.js:127-141`) — the only write path | soundcloudId, username, displayName?, avatarUrl? |
| `tokens` | Callback upsert (`auth.js:144-158`); 401-refresh update (`soundcloud-client.js:120-128`) | Refresh from the growth scheduler is **not persisted** (no token context, `soundcloud-client.js:109-116`) — rotated refresh tokens can be dropped |
| `operation_logs` | `logOperation()` only (`analytics.js:120`), 37 call sites | See 1.2/1.3 |
| `growth_actions` | Engine create (`growth-engine.js:475-489` follow, `504-516` like); follow-back updates (`api.js:2884-2890`, scheduler `growth-scheduler.js:66-72`); reverse updates (`api.js:2973-2979`) | `targetFollowers/targetFollowings` never written on 'like' rows; names/avatars are **client-asserted** at create |
| `beta_signups` | `feedback.js:80-100` | Contains email PII when wantsBeta |
| `survey_responses` | **Nothing.** Zero server references — fully orphaned legacy | |
| `chat_*`, `indexed_likes`, `indexed_playlist_tracks`, `library_snapshots` | **Nothing on this branch** — defensively declared so `db push` doesn't drop them; written only by unmerged `feature/ai-library-chat` | `indexed_likes.trackId` is already `BigInt` — the right precedent |

There are **zero `prisma.*.delete` calls anywhere** — the app never deletes rows; only schema-level cascade exists. No account-deletion path exists today (relevant in Part 3.7).

### 1.2 How `logOperation()` stores identity (`server/lib/analytics.js:70-139`)

- Dedicated columns: userId, soundcloudId, action, status, trackCount, itemCount, durationMs, errorCode, errorMessage, clientInfo.
- `trackIds` / `playlistIds` / `targetUserIds` are **merged into the `metadata` JSON** (`analytics.js:106-118`) — there are no ID columns. `trackIds` is Number-coerced, NaN-filtered, and **capped at 500** (`.slice(0, 500)`, `:111`); playlistIds/targetUserIds are uncapped. trackCount/itemCount fall back to array lengths.
- `soundcloudId`/`clientInfo` auto-populate only when the call site passes `req` (`:89-91`); ~30 of 37 sites don't, so `soundcloudId` is NULL except on auth-login/logout, library-audit, playlist-compare (and clone, which never fires — see bug #1).
- The logger is fire-and-forget and swallows its own failures (`:135-138`).
- There is **no shared metadata contract** — every route builds its own ad-hoc object. `merge` alone writes three different key sets (into-existing `api.js:1214-1222`, split `:1342-1349`, single `:1425-1432`), with the same concept named differently across them (`playlistsCreated` vs `numPlaylistsCreated`; `finalCount` means two different things).

### 1.3 Per-action inventory: what's recorded, what's discarded, what's in scope

Buckets: **[1]** full track/playlist objects in scope at the log site (snapshot = zero API cost) · **[2]** bare IDs in scope, objects not · **[3]** identity not in scope without restructuring · **[4]** doesn't touch tracks/playlists (user identity instead).

| Action | Records today | Discards at the log site | Bucket |
|---|---|---|---|
| merge | trackIds (≤500), playlistIds, rich counts, durationMs, clientInfo; **error path: no IDs** (arrays are try-scoped; `req.body` available) | Full track objects flow through the fetch loop (`api.js:1080-1093`) but aren't retained — an accumulator captures title/artist/genre free. Playlist objects (target/created) are in scope | 1 playlists / 2 tracks |
| from-likes | trackIds (client-sent, ≤5000 in, ≤500 stored), playlistIds | Route never sees track objects — client sends bare IDs; created/target playlist objects in scope with titles | 2 |
| bulk-unlike | succeeded trackIds, counts, durationMs, clientInfo | No objects exist server-side; likes request-cache holds full objects but is invalidated *before* the log (`api.js:2240`) | 2 |
| bulk-like | succeeded trackIds | Same; plus status hardcoded 'success' (`:2297`) | 2 |
| bulk-unfollow | succeeded targetUserIds, counts, dur, cI | Usernames only via followings cache (invalidated pre-log, `:2359`) | 4 |
| bulk-remove-reposts | succeeded trackIds+playlistIds | Titles only in reposts cache (invalidated pre-log, `:2485`); status hardcoded 'success' | 2 |
| clone | **nothing (bug #1)** | Full source playlist, filtered full tracks, created playlists — all in scope | 1 |
| resolve | **nothing but userId** | The full normalized resource — type, id, title, user, duration — is the very thing resolved (`cached.data` at `:942` / `normalized` at `:1006`) | 1 |
| batch-resolve | url count + failures | `results[].data` holds full resolved resources (`:2133-2138`) | 1 |
| genre-search | result count | Full normalized track results AND the search terms (genres/tags/q/bpm) — the search intent itself is unlogged | 1 |
| library-audit | playlist/track counts | `fullPlaylists` with complete tracks, and `audit.playlists[]` with per-issue trackId+title (`library-audit.js:51-66`) | 1 |
| playlist-compare | playlistIds (+broken counts, bug #2) | Both full playlists, plus full overlap/unique track objects | 1 |
| playlist-transfer | trackIds [1], playlistIds, kind | Playlist titles in `result` (`playlist-transfer.js:141-142`); track title needs a small lib change | 2 |
| delete-playlist | playlistId | Title unobtainable post-delete; needs a pre-delete fetch (extra API call) | 2 (title: 3) |
| followed-likes-to-playlist | trackIds, playlistIds, targetUserIds | Full target-user object in scope; track objects block-scoped in 'all' mode (hoistable); nonexistent in 'selected' mode | 2 |
| followed-playlist-clone | source+created playlistIds, targetUserIds | Created titles in scope; source playlists/track IDs loop-transient (accumulator) | 2 |
| proxy-download | nothing | The track ID is embedded in the format-validated URL — one regex | 2 |
| growth-discover | suggestion count | Full suggested-user objects + suggestedTrack objects (`growth-engine.js:286-353`), inspiration IDs | 4 (full objects avail.) |
| growth-engage-start | targetUserIds, trackIds | Client-asserted names/avatars (untrusted); outcomes land in growth_actions instead | 4 |
| growth-check-followbacks | checked count | DB-sourced target IDs+names in `results` (`api.js:2892-2897`); full follower objects | 4 |
| growth-reverse | targetUserIds, trackIds (attempted, not succeeded) | Full DB rows incl. targetName; per-item results unused for filtering | 4 |
| auth-login / auth-logout | userId, soundcloudId, username | Full own-profile object (login) | 4 |
| chat / library-sync (unmerged branch) | counts only | chat: tool names/args/results in scope (privacy call); library-sync: `syncLibrary` returns only counts — restructuring needed | 1 / 3 |

---

## Part 2 — The gap, verified

Your numbers, checked against the export this session — **all correct**:

- `metadata.trackIds` on exactly **125 rows**, six actions with your exact per-action counts; **18,613 distinct track IDs** from **50 users**.
- **6,093** rows with trackCount > 0 and no trackIds; total trackCount **1,688,376** (plus 174,571 itemCount — unfollows/likes/etc. — if you want total touches).
- `playlistIds` on **77 rows**, **228 distinct playlists**.
- soundcloudId **125** / clientInfo **146** / durationMs **139**.

What the code adds to your framing:

1. **All 125 trackId rows and all 77 playlistId rows date from 2026-08-06 17:20 onward.** ID capture isn't an old partial system — it's commit `42bf56a` (threaded IDs through the call sites; `dcb4d21` built the merge machinery on 2026-07-26), deployed Aug 6. You have three days of a working pipeline, not five months of a broken one.
2. **The 500-entry cap is real and already lossy:** 16 rows have trackCount above an array length of exactly 500 (`analytics.js:111`).
3. **The soundcloudId=125 count is a coincidence, not the same rows** — those are auth-login (98) + auth-logout (20) + library-audit (4) + playlist-compare (3).
4. **Metadata shape inconsistency confirmed and located:** shared *storage* helper exists (`logOperation`), shared *contract* does not — each route ad-hoc (see 1.2).
5. **Track IDs must be BIGINT:** 4,079 of the 18,613 captured IDs exceed the int32 maximum. (`indexed_likes` already uses BigInt; `GrowthAction.targetId Int` and `SurveyResponse/BetaSignup.soundcloudId Int` are latent overflow risks as SC IDs grow — worth migrating opportunistically.)
6. **Availability verdict** (decides the work): 9 actions are Bucket 1 (full objects in scope — logging identity is a few lines, metadata snapshots free); 9 are Bucket 2 (bare IDs in scope — one-line pass-through, titles need enrichment); only library-sync (unreleased) and delete-playlist titles are Bucket 3 restructuring. **No major restructuring is required to capture IDs anywhere that matters.**

---

## Part 3 — The spec

### 3.1 Schema: normalized catalog + per-event ID arrays (hybrid). Recommended.

**Recommendation: a normalized `tracks` catalog keyed by SoundCloud track ID, with operations continuing to reference IDs via the JSON arrays they already write. No per-event join table yet.**

Why, at your scale (~355k track-touches/month; 81% distinct within a 3-day window; <5% cross-user overlap):

- **Denormalizing title/artist/genre into every event** multiplies event storage ~50-100x, snapshots titles that go stale, and still can't answer "which tracks recur across users/months" without grouping the whole event history. Rejected.
- **A full `operation_tracks` join table** (~4M rows/yr) is clean but is the expensive version of something Postgres does fine at this volume with `jsonb_array_elements` over `metadata->'trackIds'` plus a GIN index. Defer it until an admin query is actually slow.
- The catalog is where the value is: one row per track ever touched, enriched once, joined on demand.

Proposed Prisma sketch (names indicative):

```prisma
model Track {
  id             BigInt    @id                    // SoundCloud track id
  title          String?
  artistName     String?
  artistId       BigInt?
  genre          String?
  genreNormalized String?
  durationMs     Int?
  access         String?                          // playable | preview | blocked | gone
  permalinkUrl   String?
  resolveStatus  String    @default("pending")    // pending | resolved | not_found | gone
  resolveAttempts Int      @default(0)
  firstSeenAt    DateTime  @default(now())
  lastSeenAt     DateTime  @updatedAt
  @@index([genreNormalized])
  @@index([artistName])
  @@index([resolveStatus])
}

model Playlist {
  id           BigInt   @id
  title        String?
  ownerScId    BigInt?
  trackCount   Int?
  firstSeenAt  DateTime @default(now())
  lastSeenAt   DateTime @updatedAt
}
```

Rows are upserted (`ON CONFLICT DO UPDATE` on title/access/lastSeenAt) — cheap, idempotent, and survives replays.

### 3.2 Capture: a shared contract, then one-line ID pass-throughs, then free snapshots

**(a) Metadata contract, enforced in `logOperation`.** Envelope: ID arrays stay as dedicated args (they already are); `metadata` becomes `{ counts?: {total, succeeded, failed}, ...actionSpecific }`; the helper normalizes, documents per-action required keys, and unifies merge's three shapes. Raise the trackIds cap to 1,000 and always write `trackIdsTruncated: true` + the true count when slicing. Enforce the status enum (`success|split|error|partial`) and fix the semantics debt while you're in there: bulk-like/bulk-remove-reposts get the same all-failed→'error' heuristic as bulk-unlike; growth-reverse stops reusing 'split'; catch-paths read IDs from `req.body` since try-scoped arrays are invisible to them.

**(b) One-line ID additions** at the sites that have IDs in scope but don't pass them: resolve (`type`+`id`+title), batch-resolve (resolved IDs by type), genre-search (result trackIds + the search terms), library-audit (playlistIds + per-issue trackIds), proxy-download (regex the track ID from the validated URL), growth-discover (suggested user IDs + inspiration IDs), growth-check-followbacks (target IDs).

**(c) Harvest-at-source** — the highest-value change in this spec. The app already fetches full track objects constantly; a single `harvestTracks(tracks[])` fire-and-forget upsert into the catalog, called from the handful of places that hold them, names most of the dataset **at zero additional SoundCloud API cost**:
- playlist fetches (`getPlaylistWithTracks` consumers: merge loop, clone, health-check, library-audit, playlist-compare)
- likes pages (`GET /api/likes`, `/api/likes/paged` — this is how bulk-unlike/from-likes IDs get names: the tracks passed through the server minutes earlier)
- search results (`searchTracks`), resolve/batch-resolve responses, activities, recently-played
Playlist identity harvests the same way from the same calls.

### 3.3 Enrichment: piggyback first, bulk endpoint for the rest

For IDs that arrive with no object in scope (client-sent bulk ops on cold caches, historical backfill):

- **Endpoint:** the vendored official spec (`docs/api.json`) confirms `GET /tracks?ids=<comma-separated>`. The client has no method for it today, but `scRequest()` (auto-refresh, 429 backoff) can drive it; `searchTracks` already targets `/tracks`, so `getTracksByIds(ids)` is a small addition, batching ~50 IDs/request.
- **Token strategy (the one open design question):** a background job has no user token. Recommended: **piggyback enrichment** — when an operation logs unknown IDs, enqueue them and resolve in the request's own token context, fire-and-forget with the existing 300ms pacing (same pattern as the growth batch runner). This sidesteps offline auth entirely and spreads load with usage. A nightly sweep for stragglers can reuse any admin session's token or a client-credentials token *if* your app registration supports that grant — verify before designing around it.
- **Volume:** steady state ~100-250k new distinct tracks/month ≈ 70-170 bulk requests/day ≈ under a minute of paced calls. Backfilling the existing 18,613 IDs is ~375 requests, one evening.
- **Failures:** increment `resolveAttempts`; after 3 failures mark `not_found`. Tracks deleted upstream: keep the row, set `access = 'gone'`, keep last-known metadata (deleted music is signal, not noise — it's what the health-check features are about). Re-harvest refreshes `lastSeenAt` and can resurrect a `gone` row.

### 3.4 History: backfill the 18.6k, don't reconstruct the rest

- **Keep all 9,235 rows.** The 125 ID-bearing rows join the catalog as soon as it exists; enrich their 18,613 tracks + 228 playlists in the one-time pass above.
- **Seed the catalog free:** your `indexed_likes` export already has 1,021 rows with title/artist/genre/access — insert them on day one.
- **The 6,093 count-only rows are unrecoverable** — the IDs were never written, and no restructuring recovers them. Don't try; their counts remain useful for volume trends. This is "backfill what exists, start fresh on what doesn't," which costs almost nothing.

### 3.5 Storage and retention

At current pace (verified: 355k track-touches/month; 81%-distinct early, declining as libraries repeat):

| Component | Growth | Year-1 estimate |
|---|---|---|
| ID arrays in `operation_logs.metadata` (already shipping) | ~8-10 B/reference | ~35-50 MB |
| `tracks` catalog (~250-400 B/row w/ indexes) | 100-250k rows/mo early, declining | ~0.3-0.7 GB worst case |
| `playlists` catalog | thousands/mo | negligible |
| Deferred join table (if ever) | ~4M rows/yr | ~250 MB — the reason it's deferred |

Comfortably inside a Neon paid tier; no retention policy *needed* year one. Sensible defaults anyway: revisit at 2 GB; if `view:*` events turn out to be live (ANALYSIS.md §5.8), prune those after 12 months — they're the only high-volume/low-value rows on the horizon.

### 3.6 Privacy and SoundCloud API terms

**Privacy (your side).** This turns operational logs into per-user listening-adjacent behavioral data (who touched which tracks, when). Three concrete obligations before shipping:
1. The privacy policy's "lightweight product-usage analytics" line (updated in `dcb4d21`) does not obviously cover track-level identity retention — update it explicitly.
2. **The app has no deletion path at all today** (zero delete calls in the codebase, no account-deletion feature). Storing this dataset without one is a GDPR/CCPA exposure — spec a "delete my account" that cascades users → operation_logs (already cascade-wired in Prisma) before or with this work.
3. Admin exploration should default to aggregate views (track × count × period), with per-user drill-down deliberate, not the default query shape.

**SoundCloud terms (their side).** The repo references the terms (`docs/api.json` → `info.termsOfService: https://developers.soundcloud.com/docs/api/terms-of-use`) but does not vendor their text, and this sandbox's network policy blocks that domain — **I could not read them, so this section tells you what to check rather than guessing:**
- The caching/storage clauses: whether storing SoundCloud **metadata** (not audio) server-side is permitted, for how long, and whether there's a refresh-or-delete-within-N-hours requirement.
- Whether cached data must be deleted when the content is removed upstream (this decides whether §3.3's keep-as-'gone' policy is allowed or must become hard deletion).
- Any prohibition on aggregating API data into datasets, analytics, or derived databases — "music dataset" language should be checked against exactly this clause.
- User-consent requirements for storing data obtained via a user's OAuth token after that user stops using the app or revokes access.
Also worth knowing: the tracks you'd store include other artists' metadata obtained through *your users'* tokens — if the terms distinguish "your data" from "SoundCloud data," this dataset is squarely the latter.

### 3.7 Ranked: value per unit of work

The two-to-three changes that capture most of the missing data:

1. **Shared contract + one-line ID pass-throughs + the two bug fixes** (§3.2a/b, §0). ~Half a day. Takes ID coverage from 6 actions to ~17, restores clone (both its logging and the feature itself), makes failures visible on bulk-like/reposts, and stops the truncation being silent. Pure capture — no new tables.
2. **Catalog tables + harvest-at-source** (§3.1, §3.2c). ~A day. This is the step that turns IDs into *music* — titles, artists, genres — at zero API cost, because merge/likes/search/audit already pull full objects through the server every day. After this, "what music moves through the tool" is one GROUP BY.
3. **Piggyback enrichment + the 18.6k backfill** (§3.3, §3.4). ~A day. Fills in everything the harvest misses (cold-cache bulk ops, history). Skippable at first — harvest alone will name the large majority of newly-touched tracks.

Defer: the join table (until a query is slow), delete-playlist title snapshots (extra API call for a 1-row/op action), anything on the unreleased chat branch, denormalized per-event snapshots (rejected outright).

Before any of it: the §3.6 terms check — it can reshape §3.3/§3.4, and it's a reading task you can do while traveling.
