# Social Media & UGC Growth Plan

*Prepared 2026-08-10 · Goal: use user-generated and founder-generated content to acquire new users organically.*

## TL;DR

The highest-leverage sequence for a solo founder:

1. **Build shareable output images into the product first** (merge summary cards, library
   "Wrapped"-style stats) — this converts the existing user base into a distribution channel
   with zero ongoing content labor.
2. **Own the TikTok/Shorts search results for the exact pain-point phrases people already
   search** ("how to merge soundcloud playlists", "how to get rid of all liked songs on
   soundcloud") with faceless screen-recording demos.
3. **Answer recurring Reddit pain posts** (r/DJs, r/Beatmatch, r/soundcloud) with disclosure
   and genuine help — slow, but the highest-intent traffic per hour invested.
4. Once organic creative proves a message, **recruit micro DJ/producer creators** ($50–150/video
   or free Pro access) to scale it — the Cal AI / Locket playbook, scaled down to niche size.

---

## 1. Why this product is unusually well-suited to UGC

- **The pain points are already searched, verbatim.** TikTok has Discover/search pages for
  "How to Merge Soundcloud Playlists" and "How to Get Rid of All Liked Songs on Soundcloud".
  People search these exact phrases *on TikTok*, and almost nobody is answering with a real tool.
- **Bulk operations are visually satisfying.** "3,400 likes → 0", a progress bar chewing
  through 1,200 tracks, a chaotic library becoming clean — this is native before/after and
  timelapse content, the two most reliable short-form formats.
- **The audience is concentrated.** DJs and producers cluster in a small number of places:
  r/DJs, r/Beatmatch, r/soundcloud, r/WeAreTheMusicMakers, producer Discords, DJ YouTube
  (Digital DJ Tips, Crossfader), and DJ TikTok/IG. The SongSwipe beta survey already targets
  this same audience — one channel strategy serves both products.
- **We already hold the data for shareable artifacts.** OAuth access + the indexed library
  tables mean we can generate personal stats images (the Receiptify/Instafest mechanic)
  without any new data collection.

## 2. Product-led virality: shareable outputs (build this first)

This is the only item in the plan that is *engineering* rather than content, and it's the
highest-leverage one. The Receiptify/Instafest/Spotify-Wrapped playbook, distilled:

1. Design the shareable image first, build the feature around it. 9:16 vertical, pre-sized
   for IG Stories/TikTok, zero cropping or friction.
2. One-tap share / download.
3. Make it about the *user's identity*, not the brand — people share "look at me", the app
   rides along via a small watermark ("made with tracktoolkit.com").
4. Piggyback existing sharing rituals rather than inventing new ones — ship the stats card
   experience in **late November**, timed to Spotify Wrapped season. SoundCloud has no
   official Wrapped; that lane is open.

### Concrete artifacts to build (in priority order)

| Artifact | Trigger | Content | Effort |
|---|---|---|---|
| **Merge summary card** | After playlist merge | "Merged 6 playlists · 1,240 tracks · 213 duplicates removed" + playlist art collage | Low — data already in merge `stats` response |
| **Cleanup report card** | After health check / bulk unlike | "Removed 47 dead tracks · library health A−" | Low |
| **SoundCloud Wrapped clone** ("Your SoundCloud, Unpacked") | Seasonal (Nov–Dec) + on-demand | Top liked artists, oldest like, total likes, follower ratio, genre breakdown | Medium — most data in `indexed_likes` / `/api/likes`; needs a render pipeline (server-side canvas/`@vercel/og`-style image generation, or client-side html-to-image) |
| **Festival-poster style top-artists image** | On-demand | Instafest mechanic applied to SoundCloud likes | Medium, do after Wrapped card proves demand |

Every artifact carries the domain watermark; the watermark is the ambient referral program.

## 3. Founder-generated short-form content (TikTok + Reels + Shorts)

**Format:** faceless screen recording + auto captions + trending audio bed + voiceover.
No face required; the algorithm rewards watch-time and completion, not personality.

**TikTok-as-SEO:** 64% of Gen Z use TikTok as a search engine and its algorithm now
prioritizes keyword matching. For every video: say the target phrase out loud, put it in
on-screen text, and put it in the caption. Target the verbatim phrases with existing
Discover pages first.

### Launch content matrix (first ~20 videos)

One video concept per tool × several hooks each. Proven hook formulas to rotate:

- Contrarian: "SoundCloud doesn't want you to know playlists cap at 500 tracks"
- Mistake warning: "Stop deleting SoundCloud likes one at a time"
- Identity call-out: "If you DJ off SoundCloud, you need to see this"
- List tease: "3 SoundCloud features that should be built-in"
- Search-match titles: "How to merge SoundCloud playlists (2026, actually works)"

Concepts: merge demo, bulk-unlike timelapse, likes→playlist, playlist health check
(before/after), 500-track-limit explainer, following cleanup, "don't paste console scripts
into SoundCloud" (safety angle vs. the old viral console-script hack — it can flag your
account; we're the safe alternative).

**Mechanics that matter (from Locket/Cal AI analyses):**
- Hook lands in the first 1–3 seconds (10–14 words); 60%+ retention past 3s is what
  triggers distribution.
- Write ~10 hook variants per concept; **re-post winners with new hooks** — Locket rode
  three repeated hooks to ~300M views. Repetition beats novelty.
- Expect power-law outcomes: most videos <1K views, occasional breakouts carry the account.
  2–3 months of consistent posting before judging the channel.

### Cadence (solo-founder sustainable)

- **Batch one recording day per week.** Record one 8–12 min screen-capture tutorial.
- Cut it into 3–5 shorts with different hooks; cross-post the same vertical video to
  TikTok, Reels, and Shorts (re-export without the TikTok watermark for Reels).
- Growth mode: 3–5 shorts/week. Survivable floor: 1–2/week.
- The long-form recording also becomes a YouTube tutorial and its transcript becomes an
  SEO/blog page (see §5) — one recording, four surfaces.

## 4. Community seeding: Reddit, Discord, YouTube channels

**Reddit is the highest-intent channel for this exact product** — the pain questions
("how do I delete all my likes", "playlist over 500 tracks", "mass unfollow") genuinely
recur. Rules to avoid getting burned:

- Age the account first: weeks of genuine participation, ~500+ karma before any promotion;
  Reddit's 2025 spam detection shadow-bans coordinated cross-posting within minutes, and its
  ranking now favors established accounts with high contributor quality scores.
- 90/10 rule; **always disclose "I built this"**; answer the actual question first and
  mention alternatives (including non-product ones), tool last.
- Never blast the same link across subreddits or do a "launch day blast".
- Monitor r/DJs, r/Beatmatch, r/soundcloud, r/WeAreTheMusicMakers, r/edmproduction for
  organic pain posts (manual weekly search or F5Bot/keyword alerts) and answer helpfully.
- Read each sub's sidebar rules; several music subs require giving feedback before posting.

**Discord:** producer/DJ servers (subreddit-linked servers, RaveVerse, DAW servers via
Disboard's producers tag). Participate, don't drop links cold.

**DJ YouTube/media:** Digital DJ Tips (~40M channel views) and Crossfader review DJ
software. A single review/feature reaches exactly the target user. Pitch them the
500-track-limit/cleanup story once the rebrand ships (pitching a trademark-risky name to
press is wasted effort — sequence this after the rename).

**Build in public on X:** treat as secondary — it earns founder credibility, backlinks,
and indie-hacker network effects, not DJ users. Weekly progress thread cadence is enough;
realistic outcome is hundreds-to-low-thousands of followers in year one.

## 5. SEO/content flywheel (supporting, not primary)

- **One landing page per tool per intent phrase**: "merge SoundCloud playlists",
  "delete all SoundCloud likes", "SoundCloud playlist limit", "mass unfollow SoundCloud",
  "SoundCloud likes to playlist". The current SERPs for these are weak (FreeYourMusic, a
  2016 console-script blog post) and winnable. Avoid thin pages — each page gets the
  tutorial embed, FAQ schema, and screenshots.
- YouTube long-tail "how to X on SoundCloud" tutorials rank fast with low competition and
  also appear in Google SERPs. Use autosuggest for exact phrasing.
- Note: the sitemap currently lists only 3 URLs (`/`, `/about`, `/privacy`) and tool pages
  are behind auth + disallowed in robots.txt. Public marketing pages per tool are a
  prerequisite for any of this SEO value. (Also flagged in the rebrand plan.)

## 6. Paid amplification & creator program (phase 2, after organic signal)

Follow the Cal AI/PhotoRoom sequence: **organic finds the message, paid/creators scale it.**

- **Micro-creator outreach:** DM small DJ/producer creators (1K–20K followers). Offer
  $50–150/video (2025-26 beginner UGC market rate) or free Pro access + affiliate cut.
  Start with 5–10 creators, 1–2 videos/month each, native-looking content (not ads).
  Scale only creators whose videos convert.
- Market rates for reference: average UGC video $150–300 (median ~$175); usage rights
  +30–50%, Spark Ads whitelisting ~+30%/month.
- TikTok Creator Marketplace (TikTok One) is available once we have an Ads Manager
  account, but sub-10K niche creators — the ones we want — are reached by direct DM.
- **Referral mechanics** (once there's a paid tier): give-get (both sides receive Pro
  time); benchmark reward value ~$20ish; tiered rewards outperform flat. Until then, the
  watermarked shareables *are* the referral program.

## 7. Measurement

- UTM every link-in-bio and landing page per channel (`?utm_source=tiktok&utm_campaign=merge-demo`).
- Track: signups by source (GA4 + the existing `/api/events` analytics), share-card
  generation count and downloads (add an event), video retention past 3s, Reddit referral
  sessions.
- Weekly 30-min review: which hooks got >3s retention, which videos drove signups; kill/iterate.

## 8. 90-day execution calendar

| Weeks | Actions |
|---|---|
| 1–2 | Build merge summary + cleanup share cards (with share event tracking). Create TikTok/IG/YT accounts (handle matching new brand — coordinate with rebrand). Start Reddit account aging (participation only). |
| 3–4 | First batch recording day; publish first 6–8 shorts targeting the verbatim search phrases. Publish 2 SEO tool pages. |
| 5–8 | Steady state: 3/wk shorts, 1 long-form YouTube tutorial every 2 wks, 1–2 Reddit answers/wk (with disclosure). Iterate hooks on best performers. |
| 9–12 | Ship "Your SoundCloud, Unpacked" stats card (or earlier if Nov is near). Begin micro-creator outreach with the 2 best-performing organic concepts. Pitch Digital DJ Tips / Crossfader (post-rebrand). |

**Effort budget:** ~5–7 hrs/week (1 batch recording half-day + edits + Reddit/community
30 min/day cap).

## Dependencies & sequencing notes

- Social handles should be registered for the **new brand name** before content starts —
  don't build an audience on a handle that has to change (see rebrand plan).
- Share-card watermark should use the new domain from day one.
- The SongSwipe beta funnel (existing survey/modal) can be cross-promoted to the same
  DJ audience once channels exist.
