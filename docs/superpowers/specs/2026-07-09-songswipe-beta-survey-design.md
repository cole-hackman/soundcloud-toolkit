# SongSwipe Beta Survey — Design Spec

**Date:** 2026-07-09
**Status:** Draft for review
**Repo:** soundcloud-toolkit (this survey ships inside SC Toolkit)

## Summary

Replace the SC Toolkit **monetization feedback survey** with a **SongSwipe beta
recruitment + problem-validation survey**. Reuse the existing survey
infrastructure (context gating, modal shell, feedback route, campaign
versioning, admin tooling) and change the payload: capture the user's **email**
(new — required), gauge interest in SongSwipe, and learn their Rekordbox
library-management pain. The monetization survey is fully retired.

### Why this works

SC Toolkit's authenticated users are SoundCloud DJs and producers — SongSwipe's
exact target market. We already prompt them at high-signal moments (after
merging/organizing their library). That's the perfect moment to pitch a
Rekordbox track-culling tool and capture a beta email.

### What this survey is NOT

These users can't run SongSwipe yet, so this is **not** UI/usability feedback.
It is: (1) interest gauge, (2) email capture for beta invites, (3) discovery of
their current Rekordbox culling pain. Usability/feature feedback happens later,
in-app, once testers are running the Electron build (out of scope here).

## Goals

1. Capture qualified beta-tester emails (Rekordbox DJs on desktop).
2. Validate the SongSwipe problem (how much do they hurt today?).
3. Segment interest so the beta cohort is well-chosen.
4. Reuse existing infra; minimize new surface area and migrations.

## Non-goals

- No change to trigger/cooldown mechanics (they already work well).
- No in-app SongSwipe feedback (separate, later, in the SongSwipe repo).
- No monetization questions (retired).

## Reuse vs. change

| Piece | Keep as-is | Change |
|---|---|---|
| `SurveyContext.tsx` gating (server-truth + localStorage snooze/cooldown/once-per-session) | ✅ | Contexts stay: `dashboard`, `post-merge`, `post-from-likes` |
| Campaign versioning via `SURVEY_CAMPAIGN_ID` / `SURVEY_ENABLED` env | ✅ | New campaign id `2026-songswipe-beta-v1` |
| `POST /survey` + `GET /survey/status` + 409 dedup | ✅ | New request/response fields |
| Admin summary + list endpoints | ✅ | Aggregate new fields; add email export |
| `MonetizationSurveyModal.tsx` | ❌ replace | New `BetaSurveyModal.tsx` (content + email field + validation) |
| `SurveyResponse` schema | ⚠️ extend | Add email + SongSwipe fields (see Data model) |
| `validateSurveySubmit` | ⚠️ rewrite | New field validation incl. email |
| Survey copy / pitch | ❌ replace | SongSwipe pitch, not "keep SC Toolkit sustainable" |

## Question set

Ordered for fast completion; only email + interest are required.

1. **Do you DJ with Rekordbox?** (required, radio)
   `rekordbox_primary` · `rekordbox_sometimes` · `other_software` · `no`
   — Qualifier. `no` short-circuits to a polite thanks (still recorded, no email required).
2. **Platform** (radio) — `mac` · `windows` · `both`
   — SongSwipe is Electron desktop; needed for build targeting.
3. **How often do you cull / clean up your library?** (radio)
   `weekly` · `monthly` · `rarely` · `never`
   — Pain frequency.
4. **Biggest pain managing your Rekordbox library today?** (multi-select + other)
   duplicates · too many untried tracks · ratings/tags upkeep · playlist sprawl ·
   finding tracks to drop · nothing really
5. **Interest in a Tinder-style swipe tool to triage Rekordbox tracks fast?** (required, pill)
   `very` · `somewhat` · `not`
6. **Want early beta access?** (checkbox, default on when interest ≥ somewhat)
   Drives whether email is a beta opt-in vs. contact-only.
7. **Email** (required, validated) — capture for beta invite / follow-up.
8. **Up for a 20-min call about your workflow?** (checkbox, optional)
9. **Anything you'd want it to do?** (optional textarea, max 2000)

**Email requirement (decided):** email is **required only when the user opts
into the beta** (`wantsBeta = true`). Pure feedback/interest responses submit
without it, so we don't suppress signal from people who are curious but not
ready to sign up. Submit gating:
- `wantsBeta` checked → `email` required + valid.
- `wantsBeta` unchecked → `email` optional (may still be given for follow-up).

## Data model

Two viable paths; **recommend Option A** (dedicated table) for clean admin
aggregation and to isolate PII.

### Option A — new `BetaSignup` table (DECIDED)

```prisma
model BetaSignup {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  soundcloudId      Int
  campaignId        String
  email             String                      // PII — required
  rekordboxUse      String                      // rekordbox_primary | rekordbox_sometimes | other_software | no
  platform          String?                     // mac | windows | both
  cullFrequency     String?                     // weekly | monthly | rarely | never
  painPoints        String?                     // comma-separated multi-select
  interest          String                      // very | somewhat | not
  wantsBeta         Boolean  @default(false)
  wantsCall         Boolean  @default(false)
  comment           String?  @db.Text
  context           String                      // dashboard | post-merge | post-from-likes
  createdAt         DateTime @default(now())

  @@unique([userId, campaignId])
  @@index([campaignId, createdAt])
  @@index([interest])
  @@index([wantsBeta])
  @@index([soundcloudId])
  @@map("beta_signups")
}
```

Keeps the proven `@@unique([userId, campaignId])` dedup and mirrors
`SurveyResponse`'s shape so the admin endpoints port with minimal change. Leaves
the old `survey_responses` table intact (historical monetization data preserved).

### Option B — generalize `SurveyResponse` with a JSON `answers` blob

Add `email String?` + `answers Json?` and drop the monetization-specific
columns from new writes. Future surveys need no migration. Cost: JSON hurts
SQL-side aggregation and typing. Reject unless you expect frequent survey
churn.

**Migration:** `npx prisma migrate dev --name add-beta-signup`. Because email is
new PII, add a short line to the privacy policy (see Privacy).

## Server changes (`routes/feedback.js`)

- `getCampaignId()` default → `2026-songswipe-beta-v1` (via `SURVEY_CAMPAIGN_ID`).
- `GET /survey/status` — unchanged shape; queries `beta_signups`.
- `POST /survey` — new validated body:
  `{ email, rekordboxUse, platform?, cullFrequency?, painPoints?, interest, wantsBeta, wantsCall, comment?, context }`.
  Keep 409-on-duplicate via unique constraint. Email trimmed + lowercased.
- Keep `SURVEY_ENABLED` kill switch.

### Validation (`validateSurveySubmit` rewrite)

- `email` — required **only if `wantsBeta === true`**; when present must be
  `isEmail`, normalized, max 254. (custom validator: reject missing email when
  `wantsBeta` is true.)
- `rekordboxUse` — required, `isIn([...])`.
- `interest` — required, `isIn(['very','somewhat','not'])`.
- `platform` / `cullFrequency` — optional `isIn`.
- `painPoints` — optional string, max 300 (comma-joined slugs).
- `wantsBeta` / `wantsCall` — optional boolean.
- `comment` — optional, max 2000.
- `context` — `isIn(['dashboard','post-merge','post-from-likes'])`.

## Client changes

### `BetaSurveyModal.tsx` (replaces `MonetizationSurveyModal.tsx`)

- Same shell (fixed overlay, focus/Escape, snooze / don't-show / submit) — copy
  from the current modal so a11y/behavior carry over.
- **Fix the token debt while we're here:** the current modal hardcodes
  `from-[#FF5500] to-[#E64A00]` and `bg-white dark:bg-card` etc. Use theme
  tokens per the design-system decision (2026-07-08).
- New pitch copy (first person, Cole): *"I'm building SongSwipe — a Tinder-style
  way to cull your Rekordbox library fast. Want early access and a say in how it
  works?"*
- Fields per the question set; email input with inline validation; submit
  disabled until `email` valid + `rekordboxUse` + `interest` set.
- If `rekordboxUse === 'no'`: collapse to a one-line "No worries — thanks!" and
  allow submit without email (records a `no` interest data point).
- Privacy microcopy under the email field: *"Only used to invite you to the
  SongSwipe beta. No spam."* + link to privacy policy.

### `SurveyContext.tsx`

- Rename types (`SurveyPreference`/`SurveyLifetime` → new field types) and the
  submit payload. Gating logic, contexts, and storage keys stay. Bump storage
  key namespace if you want everyone re-prompted regardless of prior monetization
  interaction (or just rely on the new `campaignId`, which already re-opens it).

### Triggers

Unchanged: `dashboard` (once/session), `post-merge`, `post-from-likes`. These
fire right after a user finishes organizing their library — peak relevance for a
"clean up your Rekordbox faster" pitch. Keep the heavy-user (≥100 tracks)
cooldown bypass; a DJ who just merged 800 tracks is a prime SongSwipe lead.

## Admin changes (`routes/admin.js`)

- `/feedback/summary` — aggregate by `interest`, `rekordboxUse`, `platform`,
  `wantsBeta` count.
- `/feedback` — list with the new fields.
- **Add `/feedback/beta-emails`** (admin-only) — CSV export of
  `email, wantsBeta, wantsCall, platform, interest, createdAt` where
  `wantsBeta = true`, for importing into your beta invite list. This is the
  payoff of the whole feature.

## Privacy

- Email is newly collected PII. Add one line to the privacy page: what it's for
  (SongSwipe beta invites), that it's not sold/shared, and how to request
  deletion.
- Consent is the act of submitting with the microcopy visible; store nothing
  until submit.
- Admin email export is behind existing `adminAuth`.

## Rollout plan

1. **Phase 1 — schema + server.** Add `BetaSignup`, migrate, rewrite validator +
   `feedback.js`, set new `SURVEY_CAMPAIGN_ID`. Unit-test the validator.
2. **Phase 2 — client.** Build `BetaSurveyModal` (tokenized), rewire
   `SurveyContext` payload/types, keep gating.
3. **Phase 3 — admin.** Extend summary/list, add beta-email CSV export.
4. **Phase 4 — privacy + ship.** Privacy line, flip `SURVEY_CAMPAIGN_ID` live,
   monitor first responses, then reach out to `wantsBeta` emails.

Old monetization data and code path are retired but the `survey_responses` table
is left intact for history.

## Feature-reaction questions (optional module)

Since respondents can't run SongSwipe yet, these surface the feature set from
the README and measure *appeal and priority* — useful for beta cohort framing
and roadmap ordering. **Keep the survey short:** pick at most 2–3 of these to
run alongside the core questions; every added question costs completion.
Recommended picks marked ★.

**★ Which of these would actually change your workflow?** (multi-select)
- Swipe/keyboard to keep-or-cull tracks fast
- Waveform preview with jump-to-hot-cue
- Skip presets — Intro / 32 bars / Drop / Outro
- Rate & color-tag while triaging
- Auto-suggest keep/cull by BPM, rating, or key
- Duplicate detection
- A/B compare two tracks
- Stats (keep ratio, avg BPM, color spread)
- _None of these grab me_

**★ Biggest hesitation about a tool that edits your Rekordbox library?** (multi-select)
_Validates whether the README's safety story lands._
- Corrupting `master.db`
- Losing hot cues / beatgrids
- Deleting files by accident
- Trusting a third-party tool
- None — sounds fine

**Would you trust writing directly to `master.db` if it auto-backs-up first and never runs while Rekordbox is open?** (single)
- Yes · Maybe · No, I'd only use XML export

**How do you cull your library today?** (single)
- I don't — it just grows · Manually, playlist by playlist · I have a system but it's tedious · Spreadsheet/other tool

**How would you want to drive the swipe deck?** (multi-select)
- Keyboard · Trackpad/mouse swipe · Gamepad · MIDI controller

**Which commit path fits you?** (single)
- Write straight to Rekordbox (auto-backup) · Export XML and import myself · Not sure yet

Design guidance: the two ★ questions give the most value — one measures feature
pull, one measures the trust barrier that could sink adoption. Everything else
is optional depth. Store multi-selects as comma-joined slugs (same pattern as
`painPoints`), single-selects as their own column or a small `featureAnswers`
JSON field if we don't want a migration per question.

## Decisions (resolved 2026-07-09)

1. **Data model:** Option A — dedicated `beta_signups` table. ✅
2. **Retired monetization survey:** keep modal + `survey_responses` table for
   history; new survey lives alongside, not on top. ✅
3. **Signup incentive:** none for now. ✅
4. **Email:** required only when `wantsBeta` is checked; feedback-only responses
   submit without it. ✅
