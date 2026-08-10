# Rebrand Plan: SoundCloud Toolkit → Track Toolkit (or similar)

*Prepared 2026-08-10 · Goal: remove "SoundCloud" from the name/domain without losing SEO.*

## TL;DR / Direct answers to the questions asked

**Is the rebrand worth doing?** Yes, and it's more urgent than a general "legal risk."
SoundCloud's API Terms of Use explicitly prohibit using SoundCloud marks *"or any
confusingly similar mark, as the name or part of the name of your app"* — and permit
"SoundCloud" only in a written *description* ("connects to SoundCloud"). The current
name and domain appear to violate the API ToS directly. That matters because SoundCloud's
cheapest enforcement move isn't a lawsuit — it's **revoking the app's API credentials**,
which kills the product instantly. Instagram did exactly this at scale in 2013 (banned
"Insta"/"Gram" in connected-app names; Statigram became Iconosquare or died), and
Facebook and X have equivalent clauses. Treat the rename as *when*, not *if*.

**Should you keep soundcloudtoolkit.com and point it at the new domain?** Yes —
that isn't a compromise option, it *is* the correct migration. A proper SEO-preserving
move is: keep the old domain registered indefinitely, 301-redirect every old URL
page-to-page to its new-domain equivalent, and run Google Search Console's Change of
Address. The old domain becomes a silent redirect only — no active marketing under the
old name, which is what draws trademark heat. Never let the registration lapse: an
expired domain with authority and an OAuth-app user base is prime phishing material
(a squatter could stand up a lookalike "Connect with SoundCloud" flow).

**Will SEO survive?** Mostly. 301s transfer backlink equity and page rankings; expect a
dip for 2–6 weeks and stabilization typically in 60–90 days for a well-executed move.
The one *permanent* loss: the exact-match-domain boost for queries like "soundcloud
toolkit" — redirects transfer links, not keyword-in-domain relevance. Mitigation:
keep "for SoundCloud" in titles/descriptions (nominative fair use is fine in copy),
keep URLs/content otherwise identical, and don't combine the migration with a redesign
(combining the two is the classic way migrations fail).

---

## 1. Naming decision

**"Track Toolkit" (tracktoolkit.com):** no existing product of that name surfaced in
research; closest neighbor is "TrackTool" (tracktoolpc.com), a music library manager —
worth knowing, probably not blocking. The name is descriptive/weak as a trademark
(hard to register exclusively, but correspondingly low infringement risk). Verify before
committing: registrar availability check + a USPTO TESS search (couldn't be run from
this environment).

Alternatives if tracktoolkit.com is taken or you want options:

| Name | Notes |
|---|---|
| **Playlist Toolkit** (playlisttoolkit.com) | Most SEO-descriptive; matches the core "merge/organize playlists" queries |
| **CrateKit / Cratekit** | DJ-native ("crates"); pairs well with the SongSwipe/Rekordbox audience |
| **TrackForge** | Brandable, less descriptive |
| **SetToolkit** | DJ-set angle |
| Avoid: **TrackStack** | An existing product ("Trackstack") operates in the DJ demo-inbox space |
| Avoid | Any "Cloud" + orange branding combo — the ToS also bars *confusingly similar* marks and trade dress |

Related decision: the current theme color `#FF5500` **is SoundCloud's orange**. As part
of de-risking, shift the brand accent away from SC orange (trade-dress mimicry
undermines the whole point of the rename). The color system is already tokenized in
`globals.css`, so this is a contained change.

Bonus alignment: the UI already self-brands as "SC Toolkit" (metadata, JSON-LD, icons),
so most *visible* branding barely changes; the heavy lift is the domain, not the UI copy.
Note "SC Toolkit" itself is still borderline under the "confusingly similar" clause —
the rename should go all the way to the new name, not stop at the abbreviation.

**Post-rebrand copy rule (apply everywhere):** the name/logo/domain never contain
"SoundCloud"; descriptions may say "**for SoundCloud**" (e.g., "Track Toolkit — bulk
playlist tools for SoundCloud"), always with correct "SoundCloud" capitalization. This
retains the SEO keyword in titles/meta legitimately.

## 2. Migration architecture

Target end state:

```
www.soundcloudtoolkit.com/*  ──301 (path+query preserved)──▶  www.tracktoolkit.com/*
soundcloudtoolkit.com/*      ──301──▶  www.tracktoolkit.com/*   (single hop, no chains)
api.soundcloudtoolkit.com    ── kept live during transition (OAuth callback + old tabs),
                                then 301/deprecated for non-auth routes
```

Key mechanics:

- **301 (permanent), not 302.** All 3xx pass PageRank, but 301 is the unambiguous
  canonical signal; 302 delays consolidation.
- **Page-to-page, not blanket-to-homepage.** Blanket redirects to the homepage get
  treated as soft-404s and throw away per-page equity. Since only the host changes,
  a single host-level rule that preserves path+query achieves page-to-page mapping —
  Vercel redirect config or a tiny redirect service on the old domain.
- **Canonicals must flip.** Every page on the new site self-canonicalizes to the new
  domain. Leftover canonicals pointing at soundcloudtoolkit.com make Google treat the
  new site as a duplicate of the old — the classic migration-killer. Same for `og:url`,
  JSON-LD URLs, and internal links (no internal links routed through the redirect).
- **Search Console:** verify the new domain (Domain property) *before* the move; keep
  the old property verified; run **Change of Address** from the old property (its signal
  lasts 180 days; the 301s carry it after that). Submit the new sitemap on the new
  property; temporarily keep a sitemap of old (redirecting) URLs for ~6 months so Google
  re-crawls them and finds the redirects faster.
- **Keep redirects forever.** Google's guidance: minimum 1 year; practical consensus for
  a domain with real backlinks: indefinitely. Renewal is ~$12/yr.
- **OAuth callback caveat:** the SoundCloud OAuth redirect URI must match exactly and
  cannot be a 301. Register the new callback URI (`https://api.tracktoolkit.com/api/auth/callback`)
  with SoundCloud, and keep the old URI registered and *natively served* during the
  transition window.
- **Sessions:** cookies are domain-scoped; every user gets logged out once at cutover
  and re-auths via SoundCloud OAuth. Harmless (identity lives at SoundCloud), but expect
  a blip in "active session" metrics. `localStorage` (recent tools, what's-new,
  survey cooldown) is per-origin and resets — also harmless.

## 3. Codebase touchpoint inventory

145 occurrences of brand strings across 33 files. The load-bearing ones:

**Frontend**
- `frontend-UI/src/app/layout.tsx` — metadata title/description, `authors/creator/publisher`,
  hardcoded canonical (×2: metadata + `<link>` in head), `openGraph.url/siteName/images`,
  twitter card, `metadataBase`, icon paths (`/SC Toolkit Icon.png`), `theme-color #FF5500`
- `frontend-UI/src/components/StructuredData.tsx` — JSON-LD Organization /
  SoftwareApplication / WebSite schemas (name + URLs). ⚠️ **Separate issue found while
  auditing: this file ships a fabricated `aggregateRating` (4.8, 150 ratings). That's a
  Google structured-data violation risking a manual action, and it contradicts the
  repo's own "no fabricated social proof" decision in STATE.md. Remove it during the
  migration regardless of the rebrand.**
- `frontend-UI/src/app/page.tsx` — h1 "The Ultimate SoundCloud …" → "The Ultimate
  Toolkit **for SoundCloud**" (keeps the keyword, drops it from the name position)
- `frontend-UI/public/` — `sitemap.xml` (3 URLs), `robots.txt`, `manifest.json`,
  `og-image.png`, `SC Toolkit Icon.png` (filename has the brand in it)
- `frontend-UI/vercel.json` — API rewrite target `api.soundcloudtoolkit.com`
- `localStorage` keys `sc-toolkit-*` (`survey-storage.ts`, `whatsNew.ts`, dashboard) —
  can stay (invisible to users), or migrate keys opportunistically

**Backend / infra**
- `server/routes/api.js:107` — `SC_TOOLKIT_PLAYLIST_SITE = 'www.soundcloudtoolkit.com'`
  (written into created playlists' metadata — update so new playlists advertise the new domain)
- `.do/app.yaml` + platform dashboards — `APP_URL`, `APP_URLS` (CORS allowlist),
  `SOUNDCLOUD_REDIRECT_URI`
- `.github/workflows/keep-api-warm.yml` — pings old API host
- Cookie options in `server/lib/session.js` (env/host-driven; verify the domain attribute
  at cutover)

**External surfaces**
- SoundCloud app registration: display name (currently brand-violating) + add new redirect URI
- Vercel + DigitalOcean custom domains; DNS for new apex/www/api
- Google Search Console (both properties), GA4 stream URL, Vercel Analytics
- Social handles for the new name (register **before** any UGC push — see social plan),
  Buy Me a Coffee page, email sender domain if any
- Docs: README, CLAUDE.md/AGENTS.md, privacy policy, about page

## 4. Phased execution plan

**Phase 0 — Decide & secure (1–2 days)**
1. Pick the name; check registrar + USPTO TESS; buy the domain (+ obvious typo variants
   if cheap) and register social handles.
2. Do **not** announce yet.

**Phase 1 — Dual-domain readiness (2–4 days of work)**
1. Parameterize the domain: replace all hardcoded `soundcloudtoolkit.com` references
   with a single `NEXT_PUBLIC_SITE_URL` / server env (`APP_URL` already exists —
   finish the job frontend-side: layout.tsx, StructuredData.tsx, sitemap generation).
2. Rename brand strings in UI copy, metadata, manifest; new icon/OG image files;
   remove the fake aggregateRating; shift accent color off SC orange.
3. Stand up the new domains on Vercel + DO; add new CORS origins and the new OAuth
   redirect URI (keep old ones too); update SoundCloud app display name.
4. Deploy the site to the new domain with correct self-canonicals; verify OAuth login
   works end-to-end on the new domain while the old domain still runs.

**Phase 2 — Cutover (1 day)**
1. Flip old frontend domain to host-level 301 (path+query preserving) → new domain.
2. Search Console: Change of Address from old property; submit new sitemap; keep old
   sitemap listed ~6 months.
3. Update GA4/analytics, keep-warm workflow, Buy Me a Coffee, README.
4. Announce the rename in-app via the existing What's New modal (`WHATS_NEW_VERSION` bump).

**Phase 3 — Monitor (90 days)**
- Weekly: Search Console coverage + redirect errors on both properties; rank tracking
  for the top ~10 queries; fix any redirect chains/404s immediately.
- A dip in weeks 1–2 is normal; a dip still *deepening* after ~day 30 signals a mapping
  or canonical problem — audit then.
- After ~6 months: retire the old sitemap; old API host can go redirect-only once old
  sessions/tabs have drained. The old domain itself: keep registered + redirecting forever.

## 5. Risks & costs

| Risk | Severity | Mitigation |
|---|---|---|
| SoundCloud revokes API keys before we rename | Existential | This plan; execute promptly. The rename itself is the mitigation |
| Permanent loss of exact-match-domain boost ("soundcloud toolkit" queries) | Moderate, unavoidable | "for SoundCloud" in titles/meta; those navigational queries will still find us via the 301 |
| Ranking dip during migration | Temporary (typically ≤90 days) | Page-to-page 301s, canonicals flipped, no simultaneous redesign, Change of Address |
| Migration botched (soft-404s, canonical leaks) | High if sloppy | Checklist above; a 2024 study of 892 migrations found recovery time is dominated by execution quality |
| Old domain lapses → phishing against our OAuth users | High | Auto-renew forever; ~$12/yr |
| New name conflicts | Low | TESS + registrar check before committing |

**Out-of-pocket cost:** ~$15–40/yr (domains). Everything else is labor — roughly one
focused week end-to-end.
