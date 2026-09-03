# Performance audit — September 2026

## What this is

An audit of why the web tools are slow, and the fixes that came out of it.

**On numbers in this document.** Round-trip counts are exact: they were derived
by reading every code path and are reproducible from the source. Database-side
timings are measured — see [Measured against a real
database](#measured-against-a-real-database), run on a throwaway PostgreSQL 16
instance with the production schema. **SoundCloud wall-clock figures are still
estimates**: a round trip is assumed at 250–400 ms, matching the ranges in
`docs/engineering-review-2026-08-25.md`. No SoundCloud latency was measured
against production, because that measurement did not exist when the audit
started. Producing it is the first change in this branch
(see [Instrumentation](#instrumentation)); real p95s will be readable at
`/admin` a few days after deploy, and this document should be revisited then.

## The shape of the problem

Three structural facts explain nearly all of it.

**1. Pagination is strictly sequential and cannot be otherwise.**
`paginate()` (`server/lib/soundcloud-client.js`) discovers each page's URL from
the previous response's `next_href`. A user with 5,000 likes therefore costs 25
serial round trips — 8–15 seconds — inside one HTTP request. This is a property
of SoundCloud's API, not of our code. It cannot be parallelised away, which is
why the fixes below are about *not doing the crawl* rather than doing it faster.

**2. The cache was in-memory and per-process.** It died on every deploy, so
each release put every user back on a cold crawl.

**3. The frontend asked for everything up front.** `GET /api/likes/paged` and
`likesPagedQueryOptions` both existed, were correct, and were called by nothing.

## Round trips per tool

"Before" and "after" are SoundCloud API round trips for a user with 5,000 likes,
50 playlists and 2,000 followings. Cold means nothing cached; warm means a
snapshot exists.

| Path | Before | After (cold) | After (warm) | What changed |
|---|---|---|---|---|
| `GET /playlists` | 1 + up to 50 concurrent | 1 | 0 | Stopped fetching whole playlists for cover art |
| `GET /library/audit?limit=20` | 21 serial | 21 over 5 lanes | 21 | Bounded concurrency, not fewer calls |
| `GET /library/audit?limit=50` | 51 serial | 51 over 5 lanes | 51 | ” |
| `POST /resolve/batch` (50 urls) | 50–150 serial | 50–150 over 5 lanes | fewer, 5-min resolve cache | Bounded concurrency; no double-cost retry on 429 |
| `POST /playlists/merge` (10 sources) | 10 serial + 3.0s of sleeps | 10 over 5 lanes, no read sleeps | — | Read phase was serial *and* paced with the write constant |
| Followed-library page click | ⌈2000/200⌉ + 1 = **11** | **1** | **1** | Authorization check now reads the cache it was bypassing |
| `GET /likes` | 25 serial | 25 serial | 0 | Still the cost of a full crawl; the snapshot removes the repeat |
| Like Manager first rows | 25 serial | **1** | **1** | Pages 200 at a time; the rest fills in behind an interactive list |
| Following Manager first rows | ⌈F/200⌉ ×2 serial | **2** | **2** | Followings + followers both paged |
| Repost Manager first rows | 2 full crawls | **1** | **1** | Offset-paged off the snapshot |
| `GET /me` + `/dashboard/summary` | 2 | 1 | 0 | Shared cache entry |

The two entries that did not improve when cold — `library/audit` and
`resolve/batch` — are honest: bounded concurrency turns N serial calls into
N/5 sequential *waves*, so wall time drops roughly 5×, but the call count is
unchanged. The distinction matters for rate limiting.

## Findings and disposition

### Fixed — redundant work

| Finding | Location | Note |
|---|---|---|
| `assertFollowedUser` ran a raw `getFollowings` before every followed-library page fetch, bypassing the cache the `/followings` route maintains | `routes/api.js` | Biggest single win: 11 round trips → 1 |
| `GET /playlists` fell back to `getPlaylistWithTracks` for every artwork-less playlist, unbounded, to read one `artwork_url` off `tracks[0]` | `routes/api.js` | Up to 50 concurrent requests each pulling ≤500 track objects, with the resulting 429s swallowed into silently missing covers |
| `/me` and `/dashboard/summary` each fetched the profile independently | `routes/api.js` | Now one 60s entry |
| `/dashboard/summary` cached playlists under `limit=50&offset=0`, `/playlists` under `default` | `routes/api.js` | Two entries for overlapping data, never shared |
| `getCachedUserPayload` only deduped *finished* work | `lib/social-cache.js` | Two concurrent cold readers both ran the full crawl |

#### One visible trade-off

Dropping the cover-art fan-out changes what a playlist with **no artwork of its
own** looks like in list views: it now shows the owner's avatar instead of the
first track's artwork. Playlists that have their own `artwork_url` — the large
majority — are unaffected.

This was judged worth it: the old path spent up to 50 concurrent requests, each
pulling as many as 500 track objects, to read a single field, and its swallowed
errors meant the covers frequently failed to load anyway. If the real cover
matters, the right shape is a small dedicated endpoint the client calls lazily
for the cards actually on screen, rather than resolving all of them eagerly on
every playlist list load.

### Fixed — serial that needn't be

`library/audit`, `resolve/batch` and the merge read phase all became bounded
pools via a new `mapWithConcurrency` in `lib/pacing.js`. Concurrency is 5 —
deliberately modest. The goal is to stop being serial, not to burst; the
unbounded fan-out in `GET /playlists` is what a burst looks like, and it drew
429s that were being silently swallowed.

### Fixed — correctness problems found along the way

These were not performance bugs, but the audit surfaced them.

- **`paginate()` could run for minutes.** The 30s `AbortController` deadline
  resets per page, so a 25-page crawl's worst case was ~12.5 minutes holding one
  response open. It now has a page cap and a whole-crawl deadline.
- **An unbounded 401 retry loop.** The 401 branch did `continue` with no attempt
  counter, so an endpoint that kept 401-ing after a successful refresh would spin
  forever, burning a token exchange each pass. Now bounded.
- **Truncated crawls were indistinguishable from complete ones.** Adding the
  bounds above created a way to silently return a partial library, so a
  truncated result is now flagged (non-enumerably, so callers and JSON are
  unaffected) and surfaced to the client.
- **A stale write could resurrect deleted data.** A crawl that started before a
  mutation would write its pre-mutation snapshot into the cache after the
  invalidation ran — "I unliked a track and it came back". Invalidation now
  cancels pending writes.
- **`/resolve` could hang forever.** The oEmbed supplement used bare `fetch` with
  no `AbortController`; the surrounding `try/catch` handled rejection but not
  hanging.
- **`/resolve/batch` doubled its own cost under rate limiting.** Its bare `catch`
  retried publicly on *any* error, including the 429 that caused the failure.
- **Bulk unlike/unfollow/unrepost were unpaced.** 100 sequential DELETEs with no
  delay — the most 429-prone loops in the app.

### Not acted on, deliberately

- **`preventKeyLeakage` triple-serialization** (`middleware/security.js`). Every
  response is `JSON.parse(JSON.stringify(...))`-ed and deep-walked.
  `docs/engineering-review-2026-08-25.md` measured this at 82.89µs and decided to
  keep it. That benchmark was on a *typical* payload and the cost scales with
  size, so it is worth re-measuring against a multi-MB `/api/likes` response —
  but reopening a settled decision on a guess is not worth it. **Re-measure with
  the new instrumentation before touching this.**
- **The 500-track playlist cap and the write-path pacing.** Writes to one
  playlist must be sequential and paced; this is SoundCloud's constraint. Merge
  and from-likes remain slow by nature. The read phase is where the win was.
- **`catalog.js` / `enrichment.js` / `analytics.js`.** All genuinely
  fire-and-forget; no caller awaits them. They are not in the request path and
  should not be "optimised".

## The frontend half

Two separate problems: the page couldn't start fetching, and once it had data it
couldn't render it cheaply.

### The waterfall

`AppLayout` rendered nothing — not even the sidebar — until `GET /api/auth/me`
resolved. Because children never mounted, no page's react-query hooks could
fire, so auth and data were strictly serialized on every cold load. Children now
mount eagerly in the browser so the two race.

That change has a sharp edge worth recording, because it cost a build cycle to
find: mounting children during the **static export prerender** makes the
`useSuspenseQuery` pages suspend on a fetch that can never resolve there, and
`next build` times out after 60 seconds *per page* — dashboard, combine,
like-manager and following-manager all failed this way. `tsc` does not catch it;
only a real build does. Mounting is therefore gated on a hydration flag, which
keeps the prerender childless and still mounts eagerly on the client.

**This repo has no Jest CI** (`.github/workflows/` contains only a keep-warm
cron), so Vercel's build is the only automated gate. A typecheck-clean frontend
change can still be broken. Run `npm run build` before pushing frontend work.

### Render cost

Every browse tool rebuilt its whole pipeline on every render and put every row in
the DOM.

| Page | What it did per render | Fix |
|---|---|---|
| like-manager | map + 3 filters + a sort over the entire library, allocating two `Date`s per comparison, on every keystroke | `useMemo`, precomputed sort key, 150ms debounce |
| playlist-modifier | `tracks.indexOf(track)` **inside** the render map — ~125,000 comparisons for a 500-track playlist | `id → index` Map |
| repost-manager | compiled a `RegExp` per keep-list line, then rescanned every repost | memoized, debounced |
| TrackExportCard | serialized the **entire** library to show 10 preview lines | memoized over the first 20 tracks |
| 11+ list sites | every row in the DOM; `max-h-[600px]` caps visible height, not DOM cost | `@tanstack/react-virtual` on the four worst |

Virtualization has one non-obvious constraint: shift-click range selection uses
the row index, so the index handed to a row must remain the index into the
*filtered* array, not the virtual window. That is verified in all four lists.

Also: `growth` was the only `useSuspenseQuery` page with no `loading.tsx`, so
navigating to it held the previous page on screen and read as a dead click; its
inline queries bypassed `lib/queries.ts` and so inherited `staleTime: 0`; and a
1Hz ticker re-rendered the whole ~1,500-line component every second.

### Progressive loading

The browse tools now page 200 items at a time against the `/paged` routes rather
than waiting on a full server-side crawl, so the first rows paint after one round
trip.

The fetching is the easy half. The hard half is not lying about it. A count, a
search result or a "select all" derived from a partially loaded collection has to
say what it is actually derived from:

- the status line reads *"Showing 1,200 of 5,431 — still loading…"*, and only
  prints "of N" when the server actually reported a total — `totalCount` is
  `null`, not a guess, otherwise;
- select-all reads *"Select all 1,200 loaded"* until the collection is complete;
- `ensureComplete()` exists for the paths where a partial set produces a **wrong
  artifact rather than a slow one** — exports and playlist creation. Those stay
  on the full-load path.

## Instrumentation

The audit's own recommendation is that the next round of this work be driven by
production data rather than code reading.

- Every request log line now carries `sc=<n>`, the number of SoundCloud round
  trips it made. That is the number that explains a slow endpoint.
- The eleven read endpoints are instrumented via `analytics.instrumentRead`,
  recording `durationMs` and `scCalls`. Rows are prefixed `read:` and excluded
  from the operation aggregates, so `operationsCount` and `successRate` stay
  honest.
- `/api/admin/stats` gained a per-action **p95** ranking (`readLatency`). The
  existing breakdown only computed a mean, which hides the tail users complain
  about.

## Measured against a real database

Everything above about SoundCloud latency is still an estimate. The *database*
side is not — these are from a throwaway PostgreSQL 16 instance running the
production schema, with `docs/sql/2026-library-cache.sql` applied to it.

| Measurement | Result |
|---|---|
| Migration on a `main`-schema database | applies clean; second run is a true no-op |
| 20,000-item library → page rows | 100 rows, **928 kB** on disk after TOAST |
| Snapshot write (20k items, 100 rows, one transaction) | **1,801 ms** |
| Snapshot read (20k items reassembled) | **275 ms** |
| `authenticateUser` cold (real DB round trip) | **68 ms** |
| `authenticateUser` warm (memo hit) | **4 ms** |
| `ON DELETE CASCADE` on account deletion | pages and state rows both go to 0 |

Two things worth drawing out.

**The 1.8 s write is why the snapshot write is fire-and-forget.** Awaiting it
would have added that to the cold path — the request that was already the
slowest — in exchange for removing a *future* cost. That was a real regression
caught while re-reading the diff, and the number confirms it mattered.

**275 ms to read a 20,000-item library, against 25 sequential SoundCloud round
trips to crawl it.** That gap is the whole argument for the persistent tier.

The 68 ms → 4 ms auth figure is from a local Unix-socket Postgres. Production
uses Neon, which is network-attached and serverless, so the cold number there is
larger and the memo saves more — but that also means this measurement is a
*lower* bound on the benefit, not a promise about production.

## Caching model

```
request-cache (in-process, seconds)
      ↓ miss
library_cache_pages / library_cache_states (Postgres, minutes)
      ↓ miss
SoundCloud
```

Snapshots are stored one row per 200-item page. A blob per collection is tens of
megabytes in a single row for a large library; one row per item means
reassembling the array on every read. Page rows also let a crawl write
incrementally.

Two behaviours worth knowing:

- **Stale snapshots are served, then refreshed behind the response.** An answer
  now beats a correct answer after 25 sequential round trips. The payload carries
  `stale` so the UI can say so, and concurrent stale readers share one refresh.
- **An incomplete snapshot is never served.** A half-written crawl must not be
  passed off as the user's whole library.

Everything in the snapshot tier fails soft: if the tables are missing or the
database is unreachable, reads return null and writes drop, and the request
crawls exactly as it did before.

## Known limits after this work

1. **A cold full-library read is still 25 sequential round trips.** Nothing can
   fix that except not doing it, which is what the snapshot tier and progressive
   loading are for. The first-ever load for a new user is still slow.
2. **The snapshot is per-user and populated lazily.** There is no warming job, so
   the first request after a long absence pays the crawl.
3. **`stale` is time-based, not change-based.** SoundCloud has no change feed, so
   a snapshot can be up to its TTL out of date for mutations made outside this
   app. Mutations made *through* the app invalidate correctly.
4. **The followed-library authorization check is cached for 5 minutes.** If a
   user unfollows someone on soundcloud.com (not through this app), they retain
   access to that user's *public* library for up to the TTL. Unfollowing through
   this app invalidates immediately. Judged acceptable: the data is public
   either way, and the alternative was 11 round trips per page click.
5. **The auth memo holds decrypted tokens in process memory for 30s.** Keyed
   strictly by the verified session `userId`, dropped on token refresh and
   account deletion. It is a latency optimisation only — dropping the whole cache
   restores prior behaviour.
6. **Rate limiting is still per-IP and in-memory.** It resets on deploy and is
   shared by users behind the same NAT. Raising the ceiling to 600/15min makes
   progressive loading viable but does not fix that shape.
7. **Progressive loading trades one slow wait for a longer fill.** The first rows
   arrive after one round trip instead of twenty-five, but the *whole* library
   still takes the same twenty-five to finish arriving — it just does so behind
   an interactive page. Search and sort over a partially loaded set are honest
   about their scope, not complete.
8. **Exports and playlist creation still pay the full crawl**, deliberately.
   Partial data there produces a silently wrong file or playlist, which is worse
   than a slow one.

## Running the tests

`npm test` from the repo root. 41 suites, 301 tests.

Until this branch, that command reported five failed suites on a fresh clone.
They were not failing — they could not *load*, because they import modules that
validate SoundCloud credentials at module scope, so their 33 tests never ran and
the output read as a broken suite. It misled a reader during this very audit.
`tests/setup-env.js` (wired in via `setupFiles`) now supplies dummy values, and
never overrides a value that is already set, so a real `server/.env` still wins.

No CI runs this — see the note in **The frontend half** about Vercel's build
being the only automated gate.
