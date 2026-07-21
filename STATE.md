# STATE

## Now
Branch `ui-audit-overhaul` (from main@8bfd62a) holds the UI overhaul, growth
audit fixes, AND the SongSwipe beta survey (replaces the monetization survey).
The branch is pushed but not merged or deployed. Production Neon migrations
completed July 9, 2026: `GrowthAction.inspirationNames` and `beta_signups` are
live. Landing still wants two manual assets: a
dashboard screenshot (`HERO_SHOT`) and testimonial quotes (`testimonials[]`),
both in frontend-UI/src/app/page.tsx.

## Just done
- (this session) — privacy line for beta email; accessibility pass backing the
  WCAG 2.1 AA claim (prefers-reduced-motion global CSS + FlickeringGrid static
  frame, skip-to-content link + #main-content landmarks, global focus-visible
  fallback, aria-pressed on survey toggles); admin dashboard repointed to the
  beta-survey fields + beta-emails export button (the old admin UI would have
  shown empty after the API change); CLAUDE.md updated for the new survey.
- 6d2d4e9 — SongSwipe beta survey replaces monetization survey: new
  `beta_signups` table, `validateBetaSignup` (email required only if wantsBeta),
  feedback.js on the new table (campaign `2026-songswipe-beta-v1`), admin
  summary/list + `/feedback/beta-emails` CSV export, new tokenized
  `BetaSurveyModal` (product name in `SONGSWIPE_NAME` constant for easy
  rebrand), SurveyContext rewired. Old monetization modal+table kept for
  history. Spec: docs/superpowers/specs/2026-07-09-songswipe-beta-survey-design.md.
- 478bab1 — hero product-shot frame (gated by HERO_SHOT, null=hidden),
  testimonials scaffold (empty array=hidden), following-library SelectionBanner
  bottom padding.
- de0bfdb — growth audit fixes: server-enforced daily follow cap (50/24h) +
  cooldown, paced background batch runner w/ poll+cancel, likeTrack PUT→POST,
  'followings' strategy + genre-affinity scoring (follow-ratio downweighted),
  discovery excludes prior targets, id validation, opt-in auto-like, track
  preview, analytics tab (per-seed conversion + follow-back curve), daily
  follow-back scheduler, session CSV export.
- 7edeadb — committed the pre-existing growth WIP as a clean base.
- 1b4edd1 — UI overhaul all 4 phases (animation diet, token sweep, a11y,
  dashboard grouping). Report: docs/ui-audit-2026-07-08.md.
- Verified: full Jest suite green (87), frontend production build and TypeScript
  check clean. The configured frontend lint command still requires `bunx`.

## Next
1. DONE (2026-07-09): production Neon migrated via `prisma db push` —
   `beta_signups` + `growth_actions` + `GrowthAction.inspirationNames` created,
   additive-only. Schema now also declares the cross-branch tables
   (chat_conversations, chat_messages, indexed_likes, indexed_playlist_tracks,
   library_snapshots) that live in prod but aren't owned by this branch, so
   db push doesn't drop them. Neon has 11 tables.
2. DONE (2026-07-09): privacy policy now discloses SongSwipe beta email
   collection and lightweight product-usage analytics.
3. Decide the SongSwipe/rebrand name; if renaming, change `SONGSWIPE_NAME` in
   BetaSurveyModal.tsx (one line).
4. Add the two manual landing assets (HERO_SHOT screenshot + testimonials).
5. Review branch, merge/PR, deploy, run /verify-deploy. The survey goes live the
   moment it deploys with `SURVEY_CAMPAIGN_ID` = 2026-songswipe-beta-v1.

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

## Landmines
- `prisma db push` from ANY branch syncs prod to that branch's schema and will
  DROP tables not present in it. Prod has cross-branch tables (AI chat +
  library indexing); this branch's schema now declares them so push is safe.
  Any other branch doing db push without those models would drop ~2,350 rows —
  reconcile schemas before db push from other branches.
- Growth engagement job registry is in-memory (one job/user, single-instance
  assumption, like the resolve cache). Multiple backend instances would each
  hold separate jobs — fine on the current single-instance deploy.
- The "Trusted by 2,000+ DJs & producers" line on the landing is an unbacked
  claim; verify it's real or soften it before leaning on testimonials.
- `next.config.js` rewrites/headers warnings under `output: export` are
  pre-existing and expected (dev-only rewrites).
- Landing gradient text uses `.text-gradient` — do not lighten end stops
  past #ff8a3d; earlier #ffd28f failed contrast on the cream background.
- `frontend-UI` logo assets have spaces in filenames ("/sc toolkit
  transparent .png") — referenced verbatim in code; renaming breaks pages.
