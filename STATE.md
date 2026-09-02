# STATE

## Now
The rebrand name vote is **live**. PR #31 merged (6de4ff1), the `rebrand_votes`
table exists in Neon, and the backend is deployed. Every logged-in user now sees
the shortlist modal on the dashboard and after a merge / likes-to-playlist.

Read results at `/admin` — the "Rebrand Name Vote" card shows the tally plus
every write-in name and feature request. Verify `SURVEY_CAMPAIGN_ID` is unset or
`2026-rebrand-name-v1` in DigitalOcean; a stale `2026-songswipe-beta-v1` would
silently suppress the prompt for anyone who dismissed the beta survey.

## Just done
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
1. Review and merge PR #29, then let Vercel + DigitalOcean deploy.
2. Run `/verify-deploy` against the live site — landing copy, login round-trip
   (everyone gets logged out once; confirm re-login works), one authenticated
   call. This step is REQUIRED before calling the work done.
3. Deploy the rebrand survey backend and let the vote run (the `rebrand_votes`
   table already exists). Shortlist ranking and the domain caveats behind it are
   in the PR body — TrackTidy and SortWave need an aftermarket domain purchase;
   DeckDig and DeckHaul had free .coms at time of writing (re-check at the
   registrar before buying).

## Decisions
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
