# Executive Summary — Overnight Planning, 2026-08-10

Four plans prepared (each has its own doc in `docs/plans/`):

1. [Rebrand plan](2026-08-10-rebrand-plan.md)
2. [SoundCloud feature expansion](2026-08-10-soundcloud-feature-expansion.md)
3. [Cross-platform integrations (Soundiiz-style)](2026-08-10-cross-platform-integrations.md)
4. [Social media & UGC growth](2026-08-10-social-ugc-growth-plan.md)

## The headline findings

**1. The rebrand is not optional, and it's more urgent than "maybe legal issues".**
SoundCloud's API Terms of Use explicitly forbid using "SoundCloud" (or anything
confusingly similar) in an app's *name* — it's allowed only in descriptions ("for
SoundCloud"). The realistic enforcement isn't a lawsuit; it's **API credential
revocation**, which kills the product overnight — and SoundCloud showed it will do
this (it cut off Hypeddit in June 2026). Instagram ran an identical purge in 2013.

**Answer to your domain question:** yes — keeping soundcloudtoolkit.com and pointing it
at the new domain is exactly right; that *is* the standard SEO-preserving migration, not
a shortcut. Concretely: keep the old domain registered forever (~$12/yr; letting it
lapse would hand an OAuth-app's user base to phishers), 301-redirect every URL
page-to-page (path-preserving host redirect), flip all canonicals/og:url to the new
domain, run Search Console's Change of Address, and keep "for SoundCloud" in
titles/descriptions to retain the keyword legitimately. Expect a 2–6 week ranking
wobble, stabilization typically in 60–90 days. The one permanent cost: the exact-match
domain boost for "soundcloud toolkit"-type queries. One catch: the OAuth callback URL
can't be 301'd — the old API host must stay natively live during transition.
"Track Toolkit"/tracktoolkit.com appears available (closest neighbor: "TrackTool", a
music library app) — verify with a registrar + USPTO search before committing.
Also: the accent color is literally SoundCloud orange (#FF5500); change it as part of
the rebrand, since "confusingly similar branding" is banned too.

**2. There's a Priority-0 engineering task hiding under the features question.** The
reposts feature (and possibly parts of growth) uses the unofficial api-v2 — itself an
API-ToS breach. The official API added `GET /me/reposts/*` in March 2026, plus feed
endpoints replacing the deprecated `/me/activities`. Migrating (~1 week) deletes our
biggest platform risk *and* our most complex code. After that, the 2026 API unlocks
real features: repost creation/scheduling, playlist-like management, recently-played →
playlist, related-track playlist extension, **BPM/genre/duration crate-digging search**
(DJ-native, no competitor has it), follow-back hygiene, and an artist-side toolkit
(bulk metadata editing, storefront manager, quiet-mode). What we *can't* build:
play-count analytics, notifications, comment management (no API).

**3. The Soundiiz model can't be copied in 2026 — but the best part of it can.**
Spotify has effectively closed its API to new apps (5-user dev mode, owner needs
Premium, extended access requires a registered company with 250k MAU). Deezer is closed.
But: **Spotify → SoundCloud import doesn't need Spotify's API** (public playlist
oEmbed + CSV import → match on the SoundCloud side, where we have full access, with our
500-track auto-split as a built-in advantage). Apple Music ($99/yr, no review gate) and
Tidal (open API, ISRC-exact matching; needs one approval email) are both feasible export
targets. YouTube works but is quota-crippled (~66 tracks/day) until a quota audit.
Recommended sequence: CSV import/export → Spotify→SC import (the headline) → Apple Music
→ Tidal → sync as a premium feature. Transfers are also the most natural paid tier
(Soundiiz charges $4.50/mo).

**4. Social/UGC: build the distribution into the product first.** The single
highest-leverage item is shareable output images (merge summary cards, cleanup report
cards, a "SoundCloud Wrapped"-style stats card timed for late November — SoundCloud has
no official Wrapped and we already hold the data). Second: faceless screen-recording
shorts targeting phrases people *already search on TikTok* verbatim ("how to merge
soundcloud playlists" has its own TikTok Discover page). Third: disclosed, helpful
Reddit answers on recurring pain posts (r/DJs, r/Beatmatch, r/soundcloud). Then scale
winners with $50–150/video micro DJ-creators (the Cal AI/Locket playbook at niche
scale). Sustainable solo cadence: one batch recording day/week → 3–5 shorts + 1 tutorial
+ 1 SEO page. ~5–7 hrs/week.

## Recommended master sequence (everything interlocks)

| Order | What | Why first |
|---|---|---|
| 1 | Rebrand Phase 0–1: pick name, buy domain, register social handles, parameterize domain in code | Everything downstream (handles, watermarks, press pitches) needs the new name; ToS clock is ticking |
| 2 | Priority-0 API compliance (reposts → official endpoints, activities → feed, api-v2 audit) | Protects the product's existence; ~1 wk |
| 3 | Rebrand Phase 2–3: cutover + Change of Address + 90-day monitoring | |
| 4 | Share-card artifacts + start the content engine (batch shorts, Reddit presence) | Distribution compounding starts ASAP, post-rename |
| 5 | Quick feature wins: playlist like manager, recently-played→playlist, crate-digging search | Fresh features feed the content engine |
| 6 | CSV import/export → Spotify→SC import | Headline growth feature + big SEO keyword space |
| 7 | Apple Music / Tidal integrations; "Wrapped" card in late November; monetization decision (transfers + sync as paid tier) | |

## Incidental findings from the code audit

- `StructuredData.tsx` ships a **fabricated aggregateRating (4.8★, 150 ratings)** in
  JSON-LD. That risks a Google structured-data manual action and contradicts STATE.md's
  own "no fabricated social proof" decision. Remove it regardless of the rebrand.
- The public sitemap has only 3 URLs and all tool pages are auth-gated + robots-disallowed —
  there are no public per-tool marketing pages, which caps SEO. The per-tool landing
  pages in the social plan fix this and matter *more* than usual because the rebrand
  sacrifices the exact-match-domain boost.
- `DELETE /reposts/tracks` is deprecated in the current API spec with no replacement —
  our bulk repost-removal depends on it; worth watching the soundcloud/api changelog.

## Questions for you (none blocked tonight's work)

1. **Name choice**: Track Toolkit vs. Playlist Toolkit vs. CrateKit (my lean: Track
   Toolkit or CrateKit — the latter if you want one brand family with SongSwipe for DJs).
   Need your call + a registrar/USPTO check before buying.
2. **Business entity**: do you have (or want to form) an LLC? It's the gate for
   Spotify extended-quota (long-shot), the Tidal approval email, and generally sensible
   before a paid tier.
3. **Monetization timing**: transfers + sync are the natural first paid features.
   Should pricing (e.g. free tier mirroring Soundiiz's 1-playlist/200-track cap) be
   designed into the integrations build from the start?
4. **Risk posture on Spotify ingestion**: CSV + oEmbed only (clean), or also parse
   public playlist pages (grey area under Spotify ToS)?
5. **Growth engine**: it predates tonight's research; given SoundCloud's 2026 crackdown
   posture toward growth-hacking tools, do you want a conservatism pass (it already has
   caps, which is good) or leave as-is?
6. **Content**: are you willing to be on camera, or should the content plan stay 100%
   faceless screen-recording? (Plan assumes faceless.)

## What I did NOT do tonight

No code changes — all four goals were planning asks, so the deliverables are these five
documents. The obvious first implementation PRs, when you're ready: (a) domain
parameterization + fake-rating removal, (b) reposts/feed migration to official endpoints.
