# STATE

## Now
Azure migration in flight on branch `azure/migration` (off the rebrand
branch `claude/keen-newton-02qlh4`, draft PR #39). The parallel Azure stack
in `rg-tracktoolkit` (westus3) is serving: `/health` 200, login redirects to
SoundCloud, static frontend served same-origin, pointed at the
`tracktoolkit-rehearsal` database. Waiting on Cole to add the Azure callback
URL to the SoundCloud OAuth app and do a browser login. Production
(DigitalOcean, Vercel, Neon, DNS) is untouched. Read `MIGRATION.md` first.

## Just done
- f5e7e94 — database cutover rehearsed end to end into `tracktoolkit-rehearsal`
  (dump 219 s, restore 671 s, ~16 min window, counts + structure verified);
  `docs/azure-db-cutover.md` written; 4089/4089 token rows decrypt with the
  DigitalOcean `ENCRYPTION_KEY`.
- 5cb6a0d — `infra/main.bicep` + `deploy.sh` + OIDC GitHub workflow;
  `SESSION_COOKIE_SAMESITE` env; CLAUDE.md cookie-domain error fixed.
- 86b9d08 (branch `prep/domain-switch`, pushed, not merged) — every
  domain reference → tracktoolkit.com, legacy-host 301/308 middleware,
  `infra/main.cutover.bicepparam`, 5 new tests.
- c10f378 — rebrand to Track Toolkit (PR #39, unchanged).

## Next
1. Add `https://tracktoolkit.azurewebsites.net/api/auth/callback` as an
   additional redirect URI in the SoundCloud OAuth app, log in through the
   browser on the Azure host, confirm playlists load (rehearsal DB).
2. Merge `azure/migration` (after PR #39) so `azure-deploy.yml` becomes
   dispatchable; run it once to prove the pipeline.
3. Buy tracktoolkit.com, then follow the cutover order in MIGRATION.md
   work item 4 (DNS → OAuth redirect URI → cutover params → merge
   `prep/domain-switch`) and the database procedure in
   `docs/azure-db-cutover.md`.

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

- Azure target is App Service (Linux B1, one instance, pinned) serving the
  API and `frontend-UI/out` from ONE origin; session cookie goes to
  `SameSite=Lax` via `SESSION_COOKIE_SAMESITE`. Not Container Apps, not
  Static Web Apps (2026-09-19).
- New canonical origin is the apex `https://tracktoolkit.com`; www and all
  soundcloudtoolkit.com hosts 301/308 from Express (`LEGACY_REDIRECT_HOSTS`),
  no Front Door, no stub app (2026-09-19).
- Secrets on Azure are Key Vault references by name (`infra/deploy.sh`
  header); `ENCRYPTION_KEY` / `SESSION_SECRET` carry over byte-identical
  from DigitalOcean, never regenerated (2026-09-19).
- Database client commands for the cutover run in `docker run postgres:17`,
  not the Homebrew libpq (its `pg_dump` hangs against Neon) (2026-09-19).

## Landmines
- `validateEnv` in `server/index.js` is global: with Key Vault references
  unresolved, `/health` returns 500 too. On Azure that is "secrets missing",
  not "app down" — check the body before debugging the box. References
  re-resolve on an app-settings change, not on `az webapp restart`;
  `infra/deploy.sh` nudges a setting for that reason.
- `PRISMA_CLI_BINARY_TARGETS` does not change the generated client. Build
  the deploy zip on linux/amd64 (the GitHub workflow, or Docker with
  `--platform linux/amd64`); an arm64 Docker build silently ships the wrong
  engine.
- `westus2` has no Burstable Postgres capacity for this subscription; the
  stack lives in `westus3`. Don't "fix" the region.
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
