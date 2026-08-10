# Cross-Platform Integrations Plan (Soundiiz-style transfers)

*Prepared 2026-08-10 · Feasibility of Spotify ↔ SoundCloud and other platform transfers,
researched against each platform's 2026 API reality.*

## TL;DR

The Soundiiz model is **not replicable wholesale in 2026** — the incumbents run on
grandfathered API access a new app can no longer get. But a valuable subset is very
buildable:

- **Spotify → SoundCloud (import) is the killer feature and is fully feasible**, because
  it doesn't need the Spotify API at all for the hard part: Spotify playlists can be
  ingested (public-playlist metadata/export paths), and all the *writing* happens on
  SoundCloud, where we already have first-class API access.
- **SoundCloud ↔ Apple Music and SoundCloud ↔ Tidal are feasible with official APIs**
  ($99/yr for MusicKit; Tidal's open API with native ISRC lookup).
- **SoundCloud → Spotify (export) is effectively blocked for a new app** (5-user dev
  mode, owner must hold Premium, extended access requires a registered company with
  250k MAU). Don't build the product around it; offer a CSV/export bridge instead.
- **YouTube Music is quota-bound** (~66 tracks/day on default quota) until a quota
  audit; **Deezer is closed** to new apps.

## 1. Platform-by-platform reality (2026)

| Platform | New-app viability | Detail |
|---|---|---|
| **Apple Music** | **HIGH** | MusicKit: $99/yr Apple Developer Program, self-signed JWT developer token, MusicKit JS in-browser user auth. Playlist create + add tracks + full catalog search, no review gate, no MAU threshold. Caveat: editing *existing* library playlists (remove/reorder) is limited — creation+add is the solid path. |
| **Tidal** | **MEDIUM-HIGH** | Open developer API (JSON:API, OAuth2+PKCE — same architecture as our SC proxy). Playlists CRUD via `playlists.write`, collection via `collection.*`, and **direct ISRC lookup** (`/tracks?filter[isrc]=`). Caveats: discretionary undocumented quotas; guidelines require written approval for "integrating TIDAL content with other services" — ask before building (see risks). |
| **YouTube (Music)** | **MEDIUM** | No official YT Music API; use YouTube Data API v3. Quota math: search=100u + insert=50u → ~66 tracks/day on the default 10k units. Real usage requires the quota-extension audit (weeks, compliance review). The cookie-based `ytmusicapi` route is ToS-violating — don't ship it. |
| **Spotify** | **LOW** | Feb 2026: dev-mode apps capped at **5 users**, owner must hold an active Premium subscription, 1 client ID per developer, search limit cut to 10 results. Extended quota (May 2025 criteria): registered business, **250k MAU minimum**, weeks-long review. Playlist CRUD/search technically still exist (`POST /me/playlists`, `POST /playlists/{id}/items`), and ISRC search works but is flaky; `external_ids` (ISRC) was removed from track read objects. Enforcement precedent: Spotify forced SongShift to drop transfers *away* from Spotify (2020). |
| **Deezer** | **NONE** | New app registration closed since ~2024. |

Incumbent context: Soundiiz (40+ platforms; free tier = 1 playlist at a time, 200-track
cap; Premium $4.50/mo//$36/yr) and TuneMyMusic operate on grandfathered/partner access.
Their weak spot with our audience: **SoundCloud is an afterthought for them, and their
text-based matching notoriously grabs wrong versions (remixes/live cuts)** — while
SoundCloud-native matching is exactly the thing we can be best at.

## 2. Recommended product: "Bring your library to SoundCloud" (import-first)

Positioning: not a general-purpose transfer switchboard (unwinnable vs. Soundiiz) but
**the best SoundCloud on-ramp/off-ramp**, consistent with the existing brand.

### Phase A — Spotify → SoundCloud import (no Spotify API dependency)

The insight: for imports, Spotify only needs to be *read*, and there are API-free paths:
1. User pastes a **public Spotify playlist URL** → we read the public page/oEmbed-level
   metadata (title/track list) server-side; and/or
2. User uploads a **CSV/export** (Spotify's own data export, or Exportify-style CSV —
   a de-facto standard users already know); and/or
3. Generic **text/CSV import** ("paste artist – title lines") which also covers Apple
   Music/YouTube/anything via clipboard.

Then we match each entry against SoundCloud via `GET /tracks` search (which we already
wrap), build a playlist with the existing creation/splitting pipeline (500-track
auto-split included — which incidentally means imported 1,000-track Spotify playlists
"just work", something SC's own UI can't do).

*ToS note: scraping Spotify's web pages is against Spotify ToS even without the API.
The clean version of path 1 is the oEmbed endpoint (public metadata) + CSV upload as
primary. Decide risk posture before building path 1 beyond oEmbed.*

**Match engine (the real IP, reused for every platform):**
- Normalize: strip "feat./ft.", "(Official …)", "[Free DL]", remaster/bootleg suffixes,
  bracket noise; lowercase; collapse whitespace.
- Rank candidates: exact artist+title > token-set fuzzy (e.g. Jaro-Winkler/token-sort
  ratio) with **duration tolerance ±5s** as tiebreaker; prefer uploader == artist name;
  prefer `access: playable`.
- **ISRC where possible**: SC track objects expose `isrc` for label content — when the
  source row has an ISRC (Tidal export, CSVs with ISRC), match on it first.
- **Honest UX**: per-track status (matched / needs review / not on SoundCloud) with
  manual-fix picker before creating the playlist. SoundCloud's catalog is user uploads,
  remixes, bootlegs — a chunk of licensed-catalog content won't exist and vice versa;
  the tools that force matches are the ones with bad reviews. Report a match-rate
  summary card (which doubles as shareable content, see social plan).

Effort: ~2–3 weeks including the review UI. Zero new API relationships. This is the
single most-requested transfer direction for SC-centric users (DJs moving curation
into SoundCloud).

### Phase B — SoundCloud → elsewhere (export)

1. **Universal CSV/JSON export** (playlists + likes, with title/artist/duration/ISRC
   where present). Users can take that to Soundiiz/TuneMyMusic for platforms we don't
   serve. Cheap (an `export` page already exists in the app), immediately useful, zero
   platform risk.
2. **SoundCloud → Apple Music** (first live write integration):
   - Enroll in Apple Developer Program ($99/yr), mint MusicKit key, sign developer
     token server-side (ES256 JWT, ≤6-month expiry).
   - MusicKit JS in the frontend for user auth (works fine with our static-export +
     Express proxy pattern; Music User Token flows through our backend like SC tokens).
   - Match via Apple catalog search (+ ISRC where the SC side has it), create playlist,
     add tracks.
- 3. **SoundCloud ↔ Tidal**: OAuth2+PKCE app, `playlists.write` + `collection.read`;
   ISRC-first matching via `filter[isrc]` makes this the *highest-accuracy* pairing.
   **Prerequisite: email Tidal developer support for written approval** re: the
   "integrating TIDAL content with other services" clause before investing.
4. **SoundCloud → YouTube**: build only after applying for the quota extension
   (compliance audit, weeks). Interim: cap at ~50 tracks/day/user with a queued job +
   email-when-done, or gate behind the paid tier to keep volume inside quota.
5. **SoundCloud → Spotify**: ship as **CSV hand-off** (path B1) + a 5-user
   dev-mode beta of true API export for ourselves/testers only. Revisit if/when there's
   a registered business entity with meaningful MAU for the extended-quota application —
   and note Spotify has specifically forced tools to drop *away-from-Spotify* transfers,
   so this may stay closed regardless. Say so honestly on the marketing page
   ("Spotify import: yes; Spotify export: CSV only — here's why").

### Phase C — Sync (later, premium)

Recurring one-way sync (e.g. "my Spotify playlist X mirrors to SoundCloud weekly") using
the Phase A/B machinery + a scheduler (the growth engine's daily scheduler pattern).
This is Soundiiz's stickiest premium feature and a natural paid tier here too.

## 3. Architecture notes (fits the existing stack)

- New `server/lib/` clients per platform mirroring `soundcloud-client.js`
  (apple-music-client, tidal-client, youtube-client) + a shared `match-engine.js`
  (pure functions — unit-testable with the existing Jest setup).
- New tables: `LinkedAccount` (userId, platform, encrypted tokens — reuse the AES-256-GCM
  token pattern), `TransferJob` (source, destination, status, per-track results JSON) for
  resumable/queued transfers; long transfers run as background jobs with polling UI
  (the growth engine's engage/status/cancel pattern already models this).
- Rate limiting: transfers are heavy — put them under `heavyOperationRateLimiter` and
  chunk with the existing 300ms sleep pattern.
- Privacy policy update: we'd now hold tokens for additional services + transfer logs.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Spotify hostility (ToS, SongShift precedent) | Import-first design that doesn't depend on Spotify API; CSV bridge for export; no scraping beyond oEmbed without an explicit decision |
| Tidal "integration approval" clause | Written approval before building; it's one email |
| YouTube quota audit fails/slow | Feature ships gated/queued; quota math is public, plan around it |
| Match-quality complaints (the #1 gripe against incumbents) | Review-before-create UX, honest unmatched reporting, ISRC-first where possible |
| Apple developer token leakage | Sign server-side only; never expose the private key; rotate ≤6-monthly (expiry forces this) |
| Scope creep toward "40 platforms" | Explicit non-goal; we win on SoundCloud depth, not breadth |

## 5. Sequencing & monetization hook

1. **Universal CSV import/export** (1 wk) — immediate value, zero risk, feeds SEO pages
   ("export SoundCloud playlist to CSV").
2. **Spotify → SoundCloud import** (2–3 wks) — the headline feature; huge SEO keyword
   space ("transfer spotify playlist to soundcloud" — currently served only by
   Soundiiz/TuneMyMusic behind paywalls/caps).
3. **Apple Music export** (2 wks incl. enrollment) — first true two-platform story.
4. **Tidal both directions** (2 wks, pending approval email) — best match accuracy, DJ-relevant.
5. **YouTube export** (after quota audit) → **Sync** (premium tier).

Transfers are the most natural **paid feature** in the whole roadmap (Soundiiz proves
willingness to pay $4.50/mo; our free tier could mirror theirs — e.g. 1 playlist /
200 tracks free, unlimited + sync paid) — worth folding into any monetization decision.
