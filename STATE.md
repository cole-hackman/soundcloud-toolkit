# STATE

## Now
**The Track Toolkit rebrand.** Product-owned naming across the app, the
marketing and legal pages, metadata/OG/JSON-LD, the API service name and the
playlist footer now says Track Toolkit; SoundCloud references that describe the
platform, the OAuth connection, the API or the trademark position are
deliberately kept. Two announcements ship with it (site-wide banner + a
one-time modal for signed-in users), and the name vote is retired. Not
deployed.

**The domain has not moved.** Every `soundcloudtoolkit.com` reference in the
repo is intentional until it does — that is still where the product is served.
The outstanding external steps are listed under "Rebrand follow-ups" in
README.md: register the domain, update the SoundCloud OAuth registration +
`SOUNDCLOUD_REDIRECT_URI`/`APP_URL`/`APP_URLS`, redraw the logo artwork,
re-point og-image/sitemap/robots/canonicals and file a Search Console change of
address, rename the Chrome extension listing and the DigitalOcean app.

**Before deploying the backend**, run `docs/sql/2026-library-cache.sql` in the
Neon console — it adds `library_cache_pages` and `library_cache_states`.
Additive and idempotent; the backend fails soft when the tables are absent, so
the ordering is preferred rather than load-bearing.

After deploy, leave it a few days and read `/admin` → the per-action p95 panel.
`docs/performance-audit-2026-09.md` is written against estimated round-trip
counts, not measured production latency; the instrumentation from #34 is what
produces the real numbers, and the doc should be revisited once they exist.

`SURVEY_CAMPAIGN_ID` no longer gates any prompt, so a stale value in
DigitalOcean is now inert rather than dangerous.

## Just done
- **Rebrand shipped to the branch: SC Toolkit / SoundCloud Toolkit → Track
  Toolkit.** Landing headline, nav, app shell, dashboard, login, about, privacy,
  accessibility, extension pages, admin dashboard, `manifest.json`, `robots.txt`,
  Open Graph + Twitter + JSON-LD (with `alternateName: "SoundCloud Toolkit"` so
  the rebrand stays legible to search), the `/` API service name, the playlist
  description footer, README, CLAUDE.md, SECURITY.md, ANALYSIS.md,
  DATA-COLLECTION.md.
- New `RebrandBanner` (site-wide, sticky, dismissible, publishes
  `--announcement-h` so the two fixed headers offset under it) and
  `RebrandAnnouncementModal` (one-time, signed-in only, single acknowledgement,
  focus-trapped). Both localStorage-gated via `lib/rebrand.ts`; the dashboard
  holds "What's new" back until the rebrand modal is acknowledged, so nothing
  stacks.
- **Name vote retired.** `REBRAND_VOTE_CONCLUDED` in `routes/feedback.js`:
  status reports `{ enabled: false, concluded, decidedName }`, POST answers 410
  *after* the validator (so the CSRF fail-closed invariant keeps its coverage).
  `SurveyContext.tsx`, `RebrandSurveyModal.tsx` and `survey-storage.ts` deleted,
  triggers removed from dashboard/combine/likes-to-playlist. `RebrandVote` rows
  and both admin read paths untouched.
- Post-merge review of #34-#37: no regressions found. Removed one dead import
  (`invalidateUserNamespaces` in `routes/api.js`) left behind when the write
  paths moved to `invalidateUserCollections`, and corrected CLAUDE.md's model
  count (15 → 16).
- Library audit takes `offset`, so a library bigger than one page can be walked
  (playlists 1-20, then 21-40, 41-60, ...). Previously it only ever audited the
  first 20 — and `/me/playlists` is oldest-first, so newer playlists were
  unreachable.
- New keyword search: `GET /api/playlists/search-tracks` (comma-separated terms
  OR'd, matches title + artist, scoped to one playlist or paged across all),
  plus `POST /api/playlists/tracks/bulk-remove` and `.../bulk-add`. Pure
  matching and list surgery live in `lib/playlist-search.js` with unit tests;
  route tests cover paging, partial failure and the 500-track cap.
- **Rebrand vote decided: Track Toolkit** (48/165, 29.1%), ahead of "None of
  these" (47) and TrackTidy (30). TrackTidy sat in the first option slot and
  still lost, so position bias ran against the winner rather than for it.
  Blocker is now domain + trademark, where Track Toolkit is weakest: verify
  tracktoolkit.com and clear Class 9/42 before spending on branding.
- Rebrand vote is now a **mandatory** modal: no close, Escape, backdrop click
  or snooze. Submitting is the only way out; "None of these" is the pressure
  valve; a failed submit reveals "Skip for now" so an outage can't lock anyone
  out. Snooze / don't-show / cooldown gating removed from SurveyContext and
  survey-storage, since honouring a stale dismissal would exempt earlier
  dismissers permanently.
- Option order changed to Cole's preference — TrackTidy, Track Toolkit, then
  DeckDig, SortWave, DeckHaul, None. Synced across the modal, the validator
  and the admin chart.
- Admin dashboard drops the retired SongSwipe beta-survey card; the rebrand vote
  is the only survey section. Its `/api/admin/feedback*` endpoints still work —
  including the beta-emails CSV — they are just no longer linked from the page.
- Rebrand name vote shipped to the branch: `RebrandVote` model,
  `validateRebrandVote`, rewritten `routes/feedback.js`, `RebrandSurveyModal.tsx`
  (replaces `BetaSurveyModal.tsx`), `/api/admin/rebrand{,/summary}` + an admin
  dashboard section. SongSwipe beta survey retired read-only, same as the
  monetization survey before it.
- dc4923e — landing claim fixed: "Trusted by 2,000+ DJs & producers" →
  "Trusted by 3,500+ SoundCloud users" (backed by the real 3,570 figure).
- 85c4ad2 — README stats refreshed (3,570 users / 2,032,233 tracks, 2026-08-25)
  with operation_log attribution; MIT LICENSE added; README-QUESTIONS.md deleted.
- 5ad7604 — CLAUDE.md rewritten to match actual code (5 route files, real
  server/lib tree, 13 Prisma models, growth/admin route families, CSRF+session
  invariants); AGENTS.md reduced to a pointer; docs/SECURITY.md gained CSRF and
  session-lifetime sections.
- 703e38e + d1e145d + 1ea67a5 + b5a8069 + 93fa83f — refactors: routes/growth.js
  and lib/social-cache.js extracted, three followed-library paged handlers
  collapsed into one, lib/resolve-cache.js, lib/normalize.js, lib/pacing.js.
  api.js 3,180 → 2,485 lines. No behavior change.
- 8af4958 + 2800c76 + 4ce5ab0 + da9e12a + 1e9fbaa — security: session
  timingSafeEqual + iat/TTL, rejectUntrustedOrigin on /api, 30s AbortController
  on every SC fetch, logger message sanitization on all levels, and the first
  route-level authz/CSRF tests (tests/routes/).

## Next
1. Merge this branch, then let Vercel + DigitalOcean deploy.
2. Validate against the live site — this step is REQUIRED before calling the
   rebrand done, and none of it has been done yet:
   - landing + `/about` + `/privacy` read "Track Toolkit"; the H1 is "The
     Ultimate Track Toolkit";
   - the banner renders on the landing page and inside the app, the landing nav
     and the mobile app header sit *below* it rather than under it, and
     dismissing it puts them back flush at the top;
   - log in and confirm the announcement modal appears once, that "Got it"
     dismisses it for good, and that "What's new" does not stack on top of it;
   - the name-vote modal is gone, and `GET /api/feedback/survey/status` returns
     `enabled: false`;
   - one authenticated call still works end to end;
   - re-scrape the OG card (title/description/siteName) and check `/admin` still
     renders the historical vote tally.
3. Work the external rebrand list in README.md ("Rebrand follow-ups"), in order
   — the domain gates the rest.

## Decisions
- **Name: Track Toolkit** (2026-09-10). Supersedes the live vote, which is now
  closed in code. SoundCloud references stay wherever they are factual — the
  platform, the OAuth connection, the API, the trademark position, "Continue
  with SoundCloud". Product-owned naming — titles, nav, metadata, marketing and
  legal copy, the playlist footer — is Track Toolkit.
- The headline is now "The Ultimate Track Toolkit" (2026-09-10). This replaces
  the 2026-07-08 decision to keep "The Ultimate SoundCloud Toolkit": that
  wording *was* the trademark problem, since it reads as the product's name.
  Structure and the `.text-gradient` treatment on "Toolkit" are unchanged.
- Domain references stay on `soundcloudtoolkit.com` until the new domain is
  registered and pointed (2026-09-10). Renaming them in the repo first would
  break the deployed product for no gain — the domain move is an external step,
  tracked in README.md.
- Logo and icon files keep their old paths (`/SC Toolkit Icon.png`,
  `/sc toolkit transparent .png`) (2026-09-10). The artwork still has to be
  redrawn; renaming the files without new art only breaks the paths the app and
  the Chrome extension already point at. Replace the images in place.
- `sc-toolkit-*` localStorage keys and the `sc-toolkit-*` postMessage types
  keep their names (2026-09-10). They are not user-visible, the postMessage
  types are a contract with the Chrome extension, and renaming the rest would
  silently reset every user's recent-tools list, sidebar state, growth risk
  acknowledgement and "What's new" dismissal. New rebrand keys use the
  `track-toolkit-` prefix.
- Rebrand announcements are localStorage-gated only, no DB (2026-09-10), same
  posture as "What's new". Order of precedence: rebrand modal, then "What's
  new", and the name vote is gone — never two at once.
- Headline "The Ultimate SoundCloud Toolkit" kept as-is — only subhead copy
  added around it (2026-07-08).
- Landing keeps exactly 3 animation components as signatures: FlickeringGrid
  (hero bg), WordRotate (hero), ShimmerButton (CTAs). Meteors, TypingAnimation,
  AnimatedShinyText, AnimatedGradientText, ShineBorder, GlareHover, TextAnimate
  removed from landing but component files kept (2026-07-08).
- Color system: all UI colors via HSL tokens in globals.css; hardcoded hex
  Tailwind classes are not allowed except intentional brand gradients
  (from-[#FF5500] to-[#E64A00]) and the Buy Me a Coffee button (2026-07-08).
- Dashboard tools grouped under: Playlists / Likes & Social / Library &
  Export / Discovery & Links (2026-07-08).
- Auth funnel naming: nav "Get started" → landing "Connect with SoundCloud"
  → login page "Continue with SoundCloud" (2026-07-08).
- No fabricated social proof: testimonials[] and HERO_SHOT default empty/null
  so nothing fake or broken ships; both are opt-in via real content (2026-07-09).
- Growth follows are capped server-side (50/24h + 30-min cooldown) and paced;
  auto-like is opt-in; genre affinity outranks follow-back ratio in scoring —
  the feature is positioned as scene discovery, not follow-churn (2026-07-09).
- "What's new" announcement modal is localStorage-gated only (no DB), keyed by
  `WHATS_NEW_VERSION` in lib/whatsNew.ts; bump that string to re-announce. Shows
  once on the dashboard after login, dismiss = never again, and takes priority
  over the survey so the two never stack in one session (2026-07-09).
- Public numbers must be traceable to the production operation_log. The landing
  says "3,500+ SoundCloud users" against a real 3,570; README carries the exact
  figures plus their source. Never round up past the measurement (2026-08-25).
- CLAUDE.md is the single authoritative project brief; AGENTS.md is only a
  pointer at it. Do not re-fork the two (2026-08-25).
- `express.json()` stays the ONLY body parser — it is load-bearing CSRF defense.
  Adding `express.urlencoded()` breaks the fail-closed invariant that
  tests/routes/feedback-authz.test.js guards (2026-08-25).
- Session lifetime is enforced inside the signed payload via `iat` +
  `SESSION_TTL_MS`, not by cookie maxAge alone. There is deliberately no
  server-side revocation list — documented as a known limitation, not a bug
  to "fix" with a session table unless that tradeoff is revisited (2026-08-25).
- Licensed MIT, © 2026 Cole Hackman (2026-08-25).

## Landmines
- The rebrand banner publishes its height as `--announcement-h` and the two
  `position: fixed` headers (landing nav in `app/page.tsx`, mobile header in
  `AppShell.tsx`) read it as their `top`. If you add another fixed element
  anchored to the top of the viewport, give it the same offset or it will sit
  underneath the banner. The variable is declared `0px` in `globals.css`, so
  everything is correct when there is no banner.
- The rebrand modal is mounted by `(app)/layout.tsx`, the banner by the root
  layout, so acknowledging the modal reaches the banner only through
  `REBRAND_STATE_EVENT`. A `storage` event will not do it — that one fires in
  other tabs, not this one.
- `validateRebrandVote` must stay AHEAD of the closed-vote 410 in
  `routes/feedback.js`. That POST is what
  `tests/routes/feedback-authz.test.js` uses to prove a cross-site
  form-encoded body fails closed at the validator; a gate in front of it would
  answer 410 and the invariant would go untested.
- `npm test` is self-contained again: `tests/setup-env.js` supplies dummy
  SoundCloud credentials via jest `setupFiles`, because five suites validate
  them at module scope and otherwise fail to LOAD on a fresh clone — which
  looks like a broken suite. It uses `||=`, so a real `server/.env` still wins.
  Don't remove it without re-checking a clean `npm test`.
- The auth memo (`server/lib/auth-cache.js`) holds **decrypted tokens** in
  process memory for 30s. It is invalidated at the single token-refresh choke
  point (`refreshTokensAndPersist`) and on account deletion. If you add another
  path that rotates or revokes tokens, it must call `invalidateCachedAuth` or
  users will be served a dead refresh token until the TTL expires.
- Snapshot invalidation marks rows **stale** rather than deleting them, and a
  stale snapshot is still served while it refreshes. If you add a mutation that
  changes likes/playlists/followings/followers/reposts, route its invalidation
  through `invalidateUserCollections` (not `invalidateUserNamespaces`) or the
  Postgres tier will keep serving pre-mutation data for up to its TTL.
- `library_cache_*` are NOT `library_snapshots`. The latter belongs to the
  AI-library-chat branch and stores a projected shape. Do not merge them.
- **PR #29 logs every user out once on deploy.** Legacy session cookies have no
  `iat` and are treated as expired. Expected, one-time, no data loss — but it
  will look like an outage if you forget.
- `prisma db push` from ANY branch syncs prod to that branch's schema and will
  DROP tables not present in it. Prod has cross-branch tables (AI chat +
  library indexing); main's schema declares them so push is safe. Any other
  branch doing db push without those models would drop ~2,350 rows.
- Growth engagement job registry and the resolve cache are in-memory
  (single-instance assumption). A second backend instance forks both.
- Jest fake-timer tests in tests/soundcloud-client.test.js must use
  `advanceTimersByTimeAsync` and attach `.rejects` handlers BEFORE advancing —
  `fetchWithTimeout` adds a microtask hop that broke the old tick-counted flushes.
- `next.config.js` rewrites/headers warnings under `output: export` are
  pre-existing and expected (dev-only rewrites).
- Landing gradient text uses `.text-gradient` — do not lighten end stops
  past #ff8a3d; earlier #ffd28f failed contrast on the cream background.
- `frontend-UI` logo assets have spaces in filenames ("/sc toolkit
  transparent .png") — referenced verbatim in code; renaming breaks pages.
- No CI runs the Jest suite on push. `npm test` is manual, from the repo root
  (not from frontend-UI, which has no test script).
- Survey localStorage keys are namespaced by `SURVEY_CAMPAIGN_ID`. Deploying a
  new survey while the old campaign id is still set in the environment means
  anyone who hit "Don't show again" on the previous survey never sees the new
  one. Bump or unset it with every survey swap.
- Additive schema changes go in as raw SQL via the Neon console (see
  `docs/sql/`), generated with `prisma migrate diff`. That sidesteps the
  `db push` drop hazard above entirely — SQL cannot drop what it does not
  mention. It does leave Prisma's migration history and the database out of
  step, which is inert while this project uses `db push` (no migration table)
  and would only matter on a switch to `prisma migrate`.
- Forced-choice + favourites-on-top is a known bias in the live vote: people
  who just want the modal gone click the top option, which is exactly what the
  result is meant to test. Read the top-two margin as soft. Randomising option
  order per user would fix it without giving up mandatory.
