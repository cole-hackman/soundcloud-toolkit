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

## Product name (variable)

Cole is exploring a rebrand (see Rebrand context). The Electron app's working
name is **SongSwipe**; "TrackToolkit" is a candidate. To avoid rework, the app
name in all survey copy comes from a single constant `SONGSWIPE_NAME` (client)
so a rename is one line. The survey also *asks users* for name ideas (Q11).

## Question set (FINAL — chosen 2026-07-09)

Single scrollable modal. Only **Rekordbox use** and **interest** are required;
**email** becomes required only if the user checks "beta access." Everything
else optional. Slightly longer than a cold-consumer survey is acceptable here —
respondents are engaged DJs being invited to shape a tool, not strangers.

1. **Do you DJ with Rekordbox?** (required, radio) — `rekordbox_primary` ·
   `rekordbox_sometimes` · `other_software` · `no`
   `no` collapses the rest to a short thanks (recorded; no further required fields).
2. **Platform** (radio) — `mac` · `windows` · `both` (Electron build targeting).
3. **How do you clean up your Rekordbox library today?** (radio) — `dont` (it
   just grows) · `manual` (playlist by playlist) · `tedious` (have a system but
   it's a chore) · `other_tool` (spreadsheet/something else).
4. ★ **Which of these would actually change your workflow?** (multi-select) —
   swipe_cull · waveform_cue · skip_presets · rate_tag · smart_rules ·
   dupes · ab_compare · stats · none.
5. ★ **Biggest hesitation about a tool that edits your Rekordbox library?**
   (multi-select) — corrupt_db · lose_cues · delete_files · trust_thirdparty ·
   none. (Validates whether the safety story needs to lead the marketing.)
6. **Trust direct `master.db` writes if it auto-backs-up and never runs while
   Rekordbox is open?** (radio) — `yes` · `maybe` · `xml_only`.
7. **Interest in a swipe-to-cull Rekordbox tool?** (required, pill) — `very` ·
   `somewhat` · `not`.
8. **Want early beta access?** (checkbox; auto-checks when interest ≥ somewhat).
9. **Email** (conditional — required iff Q8 checked; else optional).
10. **Up for a 20-min call about your workflow?** (checkbox, optional).
11. **Feature ideas for SC Toolkit *or* SongSwipe?** (optional textarea, 2000) —
    the general open-suggestion box for both products.
12. **Name ideas?** (optional text, 120) — "We're toying with *TrackToolkit* —
    what would you call a swipe-to-cull Rekordbox app?" Captures naming signal
    for the rebrand.

The two ★ questions are the highest-value: one measures which features to lead
the beta with, the other measures the trust barrier (a third-party tool writing
to a DJ's library) that is this app's biggest adoption risk.

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
  email             String?                     // PII — required only if wantsBeta
  rekordboxUse      String                      // rekordbox_primary | rekordbox_sometimes | other_software | no
  platform          String?                     // mac | windows | both
  cullMethod        String?                     // dont | manual | tedious | other_tool
  featuresWanted    String?                     // comma-separated slugs (Q4)
  editHesitations   String?                     // comma-separated slugs (Q5)
  trustDirectWrite  String?                     // yes | maybe | xml_only (Q6)
  interest          String                      // very | somewhat | not
  wantsBeta         Boolean  @default(false)
  wantsCall         Boolean  @default(false)
  suggestions       String?  @db.Text           // Q11 — ideas for SC Toolkit or SongSwipe
  nameIdea          String?                      // Q12 — name suggestion
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
- `platform` / `cullMethod` / `trustDirectWrite` — optional `isIn`.
- `featuresWanted` / `editHesitations` — optional strings, max 300 (comma slugs).
- `wantsBeta` / `wantsCall` — optional boolean.
- `suggestions` — optional, max 2000.
- `nameIdea` — optional, max 120.
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

## Rebrand context (direction, not commitment)

Cole is considering a **"DJ Toolkit"** umbrella brand that would host both
SC Toolkit (SoundCloud tools) and the new Rekordbox app, and possibly renaming
SongSwipe → **TrackToolkit**. This is exploratory, so this feature does NOT
hard-code any rename. Instead:

- The app name is a single `SONGSWIPE_NAME` constant in the modal; the rebrand
  is a one-line change when Cole decides.
- Q12 asks users directly for name ideas (surfacing TrackToolkit as a candidate)
  so the naming decision is data-informed.
- Q11 explicitly invites suggestions for **both** SC Toolkit and SongSwipe,
  which doubles as light validation of the umbrella-brand idea (do users think
  of these as one product family?).

If Cole later commits to "DJ Toolkit," the survey copy and constants are the
only touch points — no schema or logic change.

## Decisions (final — 2026-07-09, chosen autonomously per Cole's delegation)

1. **Data model:** Option A — dedicated `beta_signups` table. ✅
2. **Retired monetization survey:** keep modal + `survey_responses` table for
   history; new survey lives alongside. ✅
3. **Signup incentive:** none. ✅
4. **Email:** required only when `wantsBeta` checked. ✅
5. **Feature-reaction questions:** the two ★ questions + trust question folded
   into the final set (Q4–Q6). Deeper input-method/commit-path questions dropped
   to protect completion. ✅
6. **General suggestions (Q11) + name ideas (Q12):** included. ✅
7. **Product name:** kept as `SONGSWIPE_NAME` constant to make the rebrand a
   one-line change. ✅
8. **Audience-tuned copy:** first-person from Cole, DJ vernacular ("cull,"
   "crate," "master.db"), leads with the safety story given Q5's trust risk. ✅
