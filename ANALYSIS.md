# SC Toolkit — Production Data Analysis

**Date:** 2026-08-09 · **Analyst:** Claude Code session, requested by the developer before a semester abroad.
**Inputs:** five production table exports (operation_logs 9,235 rows · growth_actions 1,591 · indexed_likes 1,021 · indexed_playlist_tracks 1,242 · survey_responses 321) plus a full trace of the repo's logging, indexing, growth, and survey code with git history.

**Verification note:** every number in this document was computed from the exports or read from the code during this session. One exception: `beta_signups.json` was **not attached and is not in the repo** — the beta section answers the form-branching question from code, but the counts you quoted (117 / 86 "not" / 19 beta / 80 null platform) could not be independently verified.

---

## 1. Headline findings

1. **The product is two features.** Merge reached 820 of 1,855 logged users (44%) and from-likes reached 717 (39%); 69% of all users' *first* action is one of those two. No other tool reaches more than 11% of users. Bulk-unlike/bulk-unfollow generate huge row volume (1,554 / 1,620) but reach only 135 / 108 users — they are power-user tools whose rows are inflated by per-chunk logging.
2. **Your retention numbers are not retention numbers.** The log records tool usage, not visits: reads aren't logged, `auth-login` only began 2026-08-06 (3 days before the export ends), and the `view:<page>` events the code writes on every page open are absent from this export. "1,523 of 1,855 users on one calendar day" means "used a tool on one day," not "visited once."
3. **The empty error fields are explained and datable.** `errorCode`/`errorMessage`/`durationMs`/`clientInfo` columns only became usable in production on **2026-08-06** (migration `20260806070000`), and even now only 3 of the 8 error-writing code paths populate them. Nothing is "failing to persist" — most paths simply never pass the fields.
4. **`split` is a success**, except for 9 rows where `growth-reverse` reuses the same word to mean "partial failure." Your admin dashboard doesn't call split an error, but it **does exclude split from the headline success rate**, and it renders `partial` rows as green "OK."
5. **A real, current failure signature:** in the final three days of the export, five users produced 34 bulk-op batches where *every item failed* (`succeeded: 0`), interleaved with same-sized fully-successful batches seconds apart. The timing pattern points at duplicate submission of already-processed batches (stale selection list), but the error paths log no message, so the cause is unconfirmable from the data — which is itself the finding.
6. **The survey says $15 lifetime key**, not "ads." Your four counts were right but dropped 32 "other" responses, and 17 of the 50 free-text comments contradict their own multiple-choice answer — 12 "ads" voters and 5 "none" voters spontaneously named prices they'd pay. Mode and median of 30 price mentions: ~$15 one-time. Two comments are explicitly anti-subscription; only 4 are open to recurring billing.
7. **The indexed tables are yours alone because the feature never shipped.** The only writer of `indexed_likes`/`indexed_playlist_tracks` is the unmerged `feature/ai-library-chat` branch, which you ran locally against production. Not an export filter, not a gate users fail to reach — the code isn't deployed.
8. **~20% of your likes are blocked or preview-only, and no user can see that.** The likes API responses already carry `access`/`blocked_at`/`streamable` to the browser; like-manager and likes-to-playlist never read them. Playlist health check and library audit cover playlists only.

---

## 2. Quick answers to your specific questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Is `split` normal? | Yes — for merge, clone, from-likes, followed-likes-to-playlist it means ">500 tracks, auto-divided" and returns a normal 200 (`server/routes/api.js:1250,1337`; `594,648`; `1985,2024`; `1740`). All 494 such rows have trackCount ≥ 501. Exception: `growth-reverse` writes `split` for *partial failure* (`api.js:3003`) — 9 rows, no trackCount. Dashboard: split is not counted as error, but is excluded from `successRate` (`server/routes/admin.js:231-236`), so every legitimate auto-split depresses your headline success number. |
| 2 | Why are error fields empty? | See §5.3. Columns didn't exist in prod until 2026-08-06; 5 of 8 error paths still never pass them; the 4 populated rows are the only post-migration errors from the 3 instrumented catch blocks. Confirmed, not a persistence failure. |
| 3 | durationMs/clientInfo: few paths or failing everywhere? | **Few paths, by construction.** Only merge, bulk-unlike, bulk-unfollow have timers (`api.js:1066,2225,2344`); clientInfo additionally reaches library-audit, playlist-compare, clone via the `req` shortcut (`server/lib/analytics.js:91`). Data agrees: of 352 rows after the 2026-08-06 deploy, from-likes has 38 rows and zero with durationMs. |
| 4 | Does logging capture return visits? | **No — in this export.** Reads are unlogged, auth-login is 3 days old (98 rows, 78 users, all Aug 6–8), and a 7-day cookie means returning users don't re-login anyway. The `view:*` events that *would* measure visits (`api.js:2594-2598`, fired from `frontend-UI/src/app/(app)/layout.tsx:53-78`) appear **zero** times in the export — see §5.8. The 1-day/2-action medians are lower bounds on engagement, not retention measurements. |
| 5 | Growth funnel friction | Real friction at discover→engage (seed selection required, ~45–60 s synchronous wait, first-use ToS warning modal, 50/day cap + 30-min cooldown). The engage→check-followbacks drop is **partly a logging artifact**: a daily server scheduler checks follow-backs for everyone and never logs (`server/lib/growth-scheduler.js`, started `server/index.js:220`), making the manual button redundant. See §6. |
| 6 | Indexing gated or export filtered? | Neither — **unreleased code**. Writer is `syncLibrary` in `server/lib/library-index.js` on branch `feature/ai-library-chat`; deployed server mounts no chat routes (`server/index.js:99-105`), so `/api/library/sync` 404s in prod. The `chat` (28 rows) and `library-sync` (3 rows) actions in the logs are all you, on 2026-05-23. |
| 7 | Blocked/preview surfaced for likes? | No. Collected, sent to the browser, never rendered. `like-manager/page.tsx` and `likes-to-playlist/page.tsx` contain zero references to `access`/`blocked`/`streamable`. Playlists-only: `playlist-health-check/page.tsx:83-96`, `server/lib/library-audit.js:4-38`. |
| 8 | What do survey comments say? | ~$15 one-time lifetime key is the consensus price (mode and median of 30 price mentions); anti-subscription sentiment is explicit; 17 comments contradict the multiple choice. Your tally missed 32 "other" rows. See §7. |
| 9 | Beta null platform: branch or bug? | **Branch, by design** — answering Q1 "I don't DJ with Rekordbox" hides the platform question entirely (`BetaSurveyModal.tsx:164,348`), and even when shown it's optional and deselectable (`:265,352`). Persistence is correct. Caveat: the same short path *coerces* `interest` to `"not"` and `wantsBeta` to `false` (`:191-192`), so "86 not interested" conflates "rejected SongSwipe" with "doesn't use Rekordbox." See §8. |

---

## 3. What users actually use

All figures from operation_logs (2026-03-19 → 2026-08-08, 9,235 rows, 1,855 users; the developer account is 67 rows = 0.7%, so self-usage doesn't distort totals). "Items" sums the per-row counts (trackCount/itemCount), which corrects for bulk ops logging one row per ≤100-item chunk.

| Action | Rows | Unique users | % of 1,855 | Items processed | Code path |
|---|---:|---:|---:|---:|---|
| merge | 2,080 | **820** | 44% | 624k tracks | `api.js:1205-1446` |
| from-likes | 1,267 | **717** | 39% | 451k tracks | `api.js:1937-2027` |
| library-audit | 296 | 204 | 11% | 270k tracks scanned | `api.js:461` |
| resolve | 414 | 202 | 11% | — | `api.js:942,1006` |
| bulk-unlike | 1,554 | 135 | 7% | 78k unlikes | `api.js:2244-2265` |
| clone | 461 | 127 | 7% | 61k tracks | `api.js:642-693` |
| genre-search | 238 | 108 | 6% | 9.9k results | `api.js:2078` |
| bulk-unfollow | 1,620 | 108 | 6% | 55k unfollows | `api.js:2363-2383` |
| playlist-compare | 311 | 105 | 6% | — | `api.js:492` |
| auth-login | 98 | 78 | (3 days only) | — | `auth.js:174` |
| playlist-transfer | 335 | 29 | 1.6% | — | `api.js:736-785` |
| bulk-like | 207 | 26 | 1.4% | 18k likes | `api.js:2297` |
| followed-likes-to-playlist | 53 | 24 | 1.3% | 76k tracks | `api.js:1736` |
| batch-resolve | 32 | 23 | 1.2% | — | `api.js:2166` |
| growth-discover | 74 | 21 | 1.1% | 3.6k suggestions | `api.js:2574` |
| bulk-remove-reposts | 35 | 14 | 0.8% | 2.5k | `api.js:2487` |
| growth-engage-start | 43 | 11 | 0.6% | 1.5k follows queued | `api.js:2660` |
| growth-check-followbacks | 25 | 5 | 0.3% | — | `api.js:2913` |
| growth-reverse | 24 | 3 | 0.2% | 709 | `api.js:2999` |
| followed-playlist-clone | 17 | 11 | 0.6% | — | `api.js:1834` |
| chat / library-sync | 28 / 3 | 1 (you) | — | — | unmerged branch |

**Volume and reach tell different stories, as you suspected.** By rows, the top three are merge, bulk-unfollow, bulk-unlike. By reach, bulk ops drop to 6–7% of users while library-audit and resolve — invisible in row counts — each reach ~11%. The row inflation is mechanical: bulk endpoints cap at 100 IDs per request and the frontend chunks, so one cleanup session writes dozens of rows.

**Entry points:** first-ever action is merge for 666 users and from-likes for 605 — 69% combined. Resolve (156) and library-audit (80) are the only other meaningful entry doors. 70% of users only ever touch one tool; 562 (30%) touch two or more.

**Trend (rows / active users / first-seen users per month):** Mar 461/147/147 · Apr 1,674/453/435 · May 1,797/453/389 · Jun 2,056/438/358 · Jul 2,328/467/394 · Aug (8 days) 919/177/132. Acquisition is steady at ~360–435 new logged users/month and August is pacing *above* July. Users with any logged action in the last 90 days: **1,219** — consistent with your 1,216.

---

## 4. Retention: what this log can and cannot say

- 1,523 of 1,855 users (82%) appear on exactly one calendar day; median 2 actions per user. **Verified.**
- But the log cannot see visits: `GET /api/playlists`, `/api/likes`, `/api/me`, etc. never call `logOperation` (confirmed by trace of `server/routes/api.js`), the session cookie lasts 7 days so returns don't re-trigger `auth-login`, and auth-login itself has existed in prod for only 3 days.
- The one instrument that would answer this — `view:<page>` rows written on every app-page open (`api.js:2594`, `layout.tsx:53-78`, shipped in commit `9fcb78f`, 2026-07-09) — has **zero rows in this export** even though the same commit's growth routes demonstrably run in prod (growth rows exist from Jul 10). Either your export query filtered `view:%` (the admin operations endpoint does exactly that, `admin.js:111-116`) or the frontend ping silently fails in production. One query settles it: `SELECT count(*) FROM operation_logs WHERE action LIKE 'view:%'`.
- What can honestly be said: **at least** 18% of users (332) used tools on 2+ days, 30% used 2+ tools, and there's a real power-user core (one user: 118 distinct days, 338 actions). Splits and errors don't visibly drive churn: split users return on a later day at the same ~17% rate as everyone else, and all 9 users who hit an error had a later success.

---

## 5. What's broken or unobservable

### 5.1 Bulk-op total-failure bursts, Aug 6–8 (current, user-facing)
All 34 bulk-unlike/bulk-unfollow error rows in the dataset fall in the last 3 days and share one signature: `{succeeded: 0, failed: N}` — the whole batch failed. Five users affected. The failed batches interleave with *fully successful* same-sized batches from the same user seconds apart; for the unfollow user the two streams overlap in time (e.g. success logged 01:43:41/dur 17.9s, error logged 01:43:42/dur 15.5s), and one user then ran 11 consecutive all-fail batches of 50 over 13 minutes. **Best-fit hypothesis: duplicate submission of an already-processed batch** — double-fire or a stale client-side selection list re-submitting users/tracks that are already unfollowed/unliked, so every per-item call 404s (the only errorMessages captured anywhere that day are merge's "API request failed: 404"). SoundCloud-side rate limiting fits worse because concurrent same-user batches succeed. **Unconfirmable from data** because these paths log no error detail (next section). If the stale-list theory is right, users are watching "50 failed" toasts while their cleanup actually worked — bad UX on your two highest-volume tools.

### 5.2 growth-reverse is broken and mislabeled
24 rows: 13 error, 9 "split" (here meaning partial failure, `api.js:3003`), 2 clean successes — from 3 users. Growth_actions corroborates real damage: the July 12 user has 82 reversed follows recorded; you have 55. The reversal path also logs nothing about *why* items fail (no eC/eM/metadata). And because "split" rows count as Auto-Splits in the admin dashboard, these partial failures currently appear in a *success-ish* metric.

### 5.3 Why 47 of 51 error rows have no message (your top question)
Three stacked causes, all confirmed in code + git:
1. **Columns are young.** Original logging (`ef973b6`, 2026-03-18) had no error/duration/client columns — see migration `20260318220000_add_operation_logs`. The diagnostic columns were added to code on 2026-07-26 (`dcb4d21`) but the migration only reached production on **2026-08-06** (`6039bc8`, PR #22 — its own text says the columns "were never shipped as a migration"). So no row before Aug 6 could carry them. Daily row counts show **no gap** July 26–Aug 6 (1,158 rows, above July's 72/day average), which means the old deployed code kept logging happily — the new code and migration evidently reached production together on Aug 6.
2. **Most error paths never pass the fields, still today.** Only the three catch blocks added in `dcb4d21` populate eC/eM: merge (`api.js:1438-1446`), bulk-unlike (`2257-2265`), bulk-unfollow (`2375-2383`). The paths that produce most real-world error rows — bulk-unlike/unfollow "all items failed" (`2244-2254`, `2363-2372`), growth-reverse (`2999-3006`), playlist-transfer partial move (`777-785`), proxy-download bad redirect (`1045-1050`) — write `status:'error'` with **no** error fields. The per-item error objects are swallowed into result arrays (`api.js:2235-2237, 2354-2356, 2983-2987`) and only counts survive into metadata.
3. The 4 populated rows are exactly what the timeline predicts: post-migration merge catch-block errors ("API request failed: 404", one user, Aug 6).

### 5.4 durationMs / clientInfo are path-selective by design
Timers exist on 3 of ~20 actions (`api.js:1066, 2225, 2344`). Everything else passes nothing, so admin latency stats describe only merge/bulk-unlike/bulk-unfollow. Persistence itself works (`analytics.js:128,132`). Post-deploy data confirms: from-likes 38 rows / 0 durations. Observed batch latency where measured: ~38–45 s per 100-item bulk chunk (~400 ms/item — your rate-limit pacing), meaning a 2,000-track unlike is a ~15-minute wait users currently endure with no progress persistence.

### 5.5 Admin dashboard metric bugs
- `successRate` counts only `status='success'` (`admin.js:231-236`), so legitimate auto-splits (5.4% of all rows) depress it. Splits are 12% of merge rows — your flagship feature's dashboard success rate is structurally understated.
- `partial` is orphaned: not a filter option (`admin.js:360`), not in any rate, but in the denominator — and the UI renders unknown statuses with the *success* pill style (`admin/page.jsx:257-263`), so partial failures display as green "OK."
- "Top Errors" requires `errorCode NOT NULL` (`admin.js:174-180`), which hides 47 of your 51 error rows.
- `ACTION_NAMES` (`admin.js:10-30`) is missing auth-login, auth-logout, followed-likes-to-playlist, followed-playlist-clone — they render as raw slugs.

### 5.6 Failure-invisible endpoints
`batch-resolve` (`api.js:2166`), `bulk-like` (`2297`), and `bulk-remove-reposts` (`2487`) **always log success**, even if every item failed. Failures live only in metadata (batch-resolve) or nowhere (bulk-like, bulk-remove-reposts). Any question like "does repost removal actually work?" is unanswerable from this table.

### 5.7 The logger swallows its own failures
`analytics.js:135-138` catches and never rethrows. This time it happened to be harmless (no deploy-window gap), but the same pattern means a future schema/db drift silently deletes your analytics with zero signal. Related process risk, same incident: `dcb4d21` shipped a schema change without a migration and sat undeployed for 11 days.

### 5.8 Zero `view:*` rows (unresolved)
Described in §4 — either export filtering or a dead instrument. Worth the one-line SQL check before you leave, because it's your only visit-level signal.

### 5.9 Docs drift (minor)
CLAUDE.md documents 9 tools; production logs 20+ actions. clone, playlist-transfer, playlist-compare, library-audit, genre-search, bulk-like, delete-playlist, and the whole growth suite are undocumented there.

---

## 6. Growth feature

**Data:** 1,591 growth_actions from just **11 users** in 30 days (top user: 495 rows; you: 56 = 4%). 1,398 follows; of 1,254 checked, **17.4% followed back** (per-user range 1%–33%). 169 follows reversed.

**Funnel (21 discover → 11 engage-start → 5 check-followbacks) explained from code** (`frontend-UI/src/app/(app)/growth/page.tsx`, `server/lib/growth-engine.js`):
- *Before discover:* page requires the full followings list and 1–5 manually-selected seed artists; users following nobody are hard-blocked (`page.tsx:192,763`).
- *Discover → engage (the real cliff, 21→11):* a synchronous scan with a 45 s server budget and a UI warning it may take a minute (`growth-engine.js:13`, `page.tsx:794-799`); then a first-use interstitial in destructive styling — "Bulk following is against SoundCloud's terms if overdone" with a "Follow N — I understand" confirm (`page.tsx:1447-1463`); then possible 429s from the 50/day cap and 30-minute cooldown (`api.js:2626-2638`), sharing a 20-req/hour rate limiter with merges.
- *Engage → check-followbacks (21→5 is misleading):* the daily scheduler (`growth-scheduler.js`, on by default, never logs) already refreshes follow-back data for everyone, so the manual "Check All" button — buried in the History tab — is redundant. Low clicks here signal *nothing* about abandonment.

Interpretation: this is a deliberately throttled, warning-gated feature that 1% of users touch. The 17.4% follow-back rate is honest but modest. The one genuinely broken part is reversal (§5.2).

---

## 7. Monetization survey (321 responses, 2026-05-28 → 2026-07-10)

**Corrected distribution:** ads 177 (55%) · none 64 (20%) · **other 32 (10%) — missing from your tally** · donation 29 (9%) · pro 19 (6%). One row is your own test entry. No duplicate userIds — the unique constraint held. Contexts: dashboard 251, post-merge 40, post-from-likes 30; steady trickle across all 44 days, not a blast.

**The 50 comments (15.6% comment rate) tell a different story than the multiple choice:**
- **30 comments name a price.** Mode and median ≈ **$15 one-time lifetime key** (≈10 mentions at/around $15; a $5–10 cluster; a tail to $50). Two benchmark-quality datapoints: one user cites tunemymusic's $24/yr and offers $25–50 lifetime; another details $10 lifetime or $0.99/mo.
- **Contradictions (17 rows):** 12 "ads" voters and 5 "none" voters named prices anyway (e.g., "none" + "$15 lifetime"). Reading: many picked whichever option keeps the tool free *for them*, then answered the price question in the comment box. "None" ≠ "won't pay."
- **Subscription hostility is explicit** ("please just dont go subscription based"; "i wouldnt pay a monthly fee personally") vs. only 4 comments open to recurring. Three independently propose the classic hybrid: ads on free tier, one-time payment removes them.
- **Survey-design flaw:** at least 5 commenters answered before ever using the product ("this is the first screen im seeing") because the dashboard modal fires on first visit — dashboard-context answers understate willingness to pay. `lifetimeInterest` was skipped by 42%.
- Cross-tab sanity: "pro" voters are 64% interested in a lifetime key; "none" voters 54% not-interested — the fields are coherent, just leaky at the individual level.
- Feature requests inside the survey: BPM organizer, mass playlist-like, MP3 download; one grandfather-early-supporters request. Zero bug reports.

---

## 8. SongSwipe beta signups

Data file absent — code-level answers only, counts unverified.

- **Null platform is the form working as designed.** Q1 "I don't DJ with Rekordbox" hides platform, cullMethod, featuresWanted, hesitations, trust, interest, beta, and call questions (`BetaSurveyModal.tsx:164, 348-450`); platform is optional and deselectable even when shown (`:265, 352`); the context/server layers store null correctly (`SurveyContext.tsx:167-174`, `feedback.js:87-89`).
- **Your "86 of 117 not interested" needs reframing before you act on it.** The short path *coerces* `interest` to `"not"` and `wantsBeta` to `false` for every non-Rekordbox respondent (`BetaSurveyModal.tsx:191-192`). If ~80 null-platform rows ≈ the Q1-"no" cohort, then the 86 mostly means "**doesn't use Rekordbox**," not "Rekordbox DJs rejected SongSwipe." The interesting denominator is Rekordbox users only (~37 rows by this logic, of whom 19 wanted the beta — a ~51% conversion if the arithmetic holds on the real data). Check with: `SELECT rekordboxUse, interest, wantsBeta, count(*) FROM beta_signups GROUP BY 1,2,3`.

---

## 9. What to build next, ranked by evidence strength

**Solid data — do before leaving (small, high-leverage):**
1. **Close the error-observability gap** (§5.3, §5.6). Pass the first per-item error into eC/eM on the all-failed bulk paths and growth-reverse; stop logging unconditional success on bulk-like/batch-resolve/bulk-remove-reposts. A few lines each; converts every future incident from "unknowable" to "readable." Evidence: 47 of 51 error rows are unexplainable today.
2. **Diagnose the bulk-op duplicate-submission/stale-list bug** (§5.1). It's on your two highest-volume tools, active in the last 72 hours of data, and cheap to reproduce (unlike a page, watch the selection list). Evidence: strong that it happens; the mechanism is a hypothesis pending #1.
3. **Fix dashboard semantics** (§5.5): count split as success (or success+split), give partial a real state, drop the `errorCode NOT NULL` filter, split growth-reverse's status collision (§5.2). Otherwise the dashboard you check from abroad understates your flagship's health and greenlights partial failures.
4. **Run the two one-line SQL checks:** `view:*` count (§5.8 — decides whether you have visit data at all) and the beta cross-tab (§8).

**Strong data — product direction:**
5. **Ship the $15 lifetime key, keep a free tier** (§7). 30 priced comments converge there; anti-subscription sentiment is explicit; contradiction analysis shows even "ads"/"none" voters would pay. This is the best-evidenced product decision available to you. (Ads remain viable as the free tier per the hybrid suggestions, but "55% chose ads" alone was overstating it.)
6. **Double down on merge/from-likes polish, not new tools** (§3). 69% of users enter there, 70% never touch a second tool, and reach numbers say new sidebar entries mostly go unseen. The cheapest growth is making the two doors people already walk through convert to a second visit — e.g. post-merge nudges toward library-audit (11% reach when found, and it's adjacent).

**Informed guesses — worth it, but the data is thin:**
7. **Likes health check** (§2 Q7). The 20% blocked/preview figure is n=1 (your library), but the data already reaches the browser, `library-audit`'s 204-user reach shows appetite for health tooling, and it's a small UI addition to like-manager. Guess on demand, solid on cost.
8. **Retention instrumentation, then judge retention later** (§4). auth-login is now live; with `view:*` verified or fixed, you'll have real return-visit data in a few weeks abroad — decide nothing about churn until then.
9. **Growth feature: leave it capped, fix only reversal** (§6). 11 users/30 days and a deliberate throttle design; no evidence it deserves investment now, and clear evidence its undo path corrupts trust.
10. **SongSwipe: don't read the beta as a rejection** (§8). The instrument mostly measured "who uses Rekordbox." The 19 opt-in emails are your validated interview list; the platform question was never going to tell you more.

**Not supported by current data:** building anything on the indexing/AI-chat branch for general users (zero non-developer exposure, `OPENAI_API_KEY` dependency), or investing in bulk-repost tooling (14 users in 5 months).
