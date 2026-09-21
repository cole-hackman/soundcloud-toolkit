# TERMS-CHECK — SoundCloud API Terms Questions Blocking the Catalog Branch

The vendored OpenAPI spec (`docs/api.json`, `info.termsOfService`) points to
the governing terms: **https://developers.soundcloud.com/docs/api/terms-of-use**

The terms text is **not** in this repo and could not be fetched from this
environment (network egress blocked). Nothing below is a reading of the terms —
it is a checklist of exactly what to verify yourself before deploying the
branch or running the backfill. The backfill job (~18,613 historical track IDs)
is gated behind a default-off env flag and has **not** been executed; keep it
off until every item below is answered.

---

## 1. Metadata caching / storage duration limits

**What to check:** Does the terms-of-use limit how long API responses (or data
derived from them) may be cached or stored? Common patterns: a fixed TTL
(e.g. 24 hours / 30 days), "no permanent storage", or "cache only as needed to
operate the service".

**What depends on the answer:**
- The `tracks` / `playlists` catalog itself, which stores title, artist,
  genre, duration, and access status **indefinitely** ("retained while the
  service operates").
- The operation-log metadata JSON, which retains touched-ID arrays with no
  expiry.
- The backfill job, which would bulk-populate the catalog from historical IDs.

**If restrictive:** switch the catalog to TTL-based storage — stamp each row
with `fetchedAt` and either re-verify against the API or delete rows older
than the permitted window; drop the "retained while the service operates"
wording from the privacy draft; and do not run the backfill (bulk-storing
18k rows is the least defensible act under a caching limit).

## 2. Delete-on-upstream-removal requirements

**What to check:** Does the terms-of-use require deleting cached/stored data
when the underlying content is removed from SoundCloud (track deleted, made
private, or taken down)?

**What depends on the answer:**
- The current design's **keep-row-with-`access='gone'`** policy: when a track
  disappears upstream, the catalog keeps the row, flips access to `'gone'`,
  and preserves the last-known metadata (title, artist, genre, duration).

**Does keep-as-'gone' survive a delete-on-removal clause? No.** If the terms
require deleting cached data when content is removed upstream, retaining
last-known metadata under a `'gone'` flag is exactly the retention the clause
prohibits — the flag does not change what is stored. In that case `'gone'`
must become a **hard delete**: the row is removed (at most an opaque tombstone
of the numeric ID with no metadata, and only if the terms permit even that).
The aggregate view would then lose deleted tracks from historical trends;
accept that rather than argue the flag is compliance.

## 3. Dataset / aggregation prohibitions

**What to check:** Does the terms-of-use prohibit building databases or
datasets from API data, aggregating data across users, or using API data for
analytics beyond operating the service? Watch for wording like "no data
mining", "no building a database of SoundCloud content", or purpose-limitation
clauses ("solely to provide your application's functionality to the user").

**What depends on the answer:**
- The catalog **is** a cross-user database of SoundCloud content — that is
  its point.
- The **admin-only aggregate view** (trends by genre/artist/availability
  across all users' operations) is analytics beyond serving any individual
  user's request.
- The backfill exists only to make that dataset more complete; it serves no
  user-facing feature.

**If restrictive:** do not run the backfill at all (delete the flag and job);
drop the admin aggregate view; and either drop the catalog or narrow it to a
strict per-request cache used only to serve the requesting user's own
features. A purpose-limitation clause alone — even without an explicit
database prohibition — likely forbids the trend-analysis use.

## 4. Post-revocation retention

**What to check:** What must be deleted when a user revokes OAuth access or
deletes their account? Does anything obtained via that user's token have to
go, or only their tokens/credentials and personal data?

**What depends on the answer:**
- **Operation logs:** the branch retains a user's operation-log ID arrays
  after they stop using the app (only account deletion removes them, and
  OAuth revocation by itself deletes nothing).
- **Catalog rows sourced via a revoked user's token:** enrichment calls
  `GET /tracks?ids=` with the user's own OAuth token. If the terms say data
  obtained through a user's authorization must be deleted when that
  authorization is revoked, rows (or fields) that exist *only* because of that
  user's token are affected — and today the schema does not record which
  token sourced which row, so provenance tracking would have to be added
  before the rule could even be enforced.

**If restrictive:** on revocation/deletion, purge catalog rows sourced only
from that user's token (requires adding a `sourceUserId`/provenance column
first); treat detected OAuth revocation like account deletion for operation
logs; and shorten operation-log retention rather than keeping ID arrays
indefinitely for departed users.

---

## Client-credentials question (why enrichment is piggyback-only)

`docs/api.json` → `components.securitySchemes.oAuth2_1.flows` declares **both**
`authorizationCode` and `clientCredentials` flows, so the SoundCloud API
*generally* supports app-level (client-credentials) tokens. But whether **this
app's registration** is enabled for client credentials cannot be determined
from the repo — that depends on the app's registration with SoundCloud, not on
the spec.

Consequences, as implemented:
- Catalog enrichment ships **piggyback-only**: `GET /tracks?ids=` is called
  with the requesting user's own OAuth token, during that user's operations.
- A **nightly client-credentials sweep** (re-verifying catalog availability
  status app-wide without any user token) is **not built**. Before building
  it: confirm the registration actually issues client-credentials tokens, and
  re-check items 1–3 above — a background sweep is service-operator analytics,
  not user-serving activity, and sits squarely under any purpose-limitation
  clause.

---

# Answers (2026-09-22)

The four questions above are now answered. The terms were checked **outside
this environment** — egress is still blocked here, so the findings below are
recorded as substance, not as transcription. Each heading states what the
terms require and, in a `> TERMS:` block, leaves a slot for the exact sentence
to be pasted in from
https://developers.soundcloud.com/docs/api/terms-of-use. **Do not treat the
paraphrases as quotations**; if a decision ever turns on precise wording,
fill the slots first.

Items that remain non-compliant are marked as such rather than quietly closed.

## Finding A — a privacy policy is required

> TERMS: _[paste the privacy-policy clause verbatim]_

**Substance.** A readily accessible privacy policy is a condition of using the
API. It must describe what is collected, how it is used, and how a user gets
it deleted.

**What this branch does.** The privacy page is the disclosure surface; the
mechanisms it must be able to point at now exist rather than being described
in the abstract:

- `GET /api/auth/export` — every row keyed to the user, as a JSON download.
- `DELETE /api/auth/account` — deletes the account; every per-user table
  cascades (guarded by `tests/account-deletion-cascade.test.js`).
- `POST /api/auth/disconnect` — the middle step: hands the grant back and
  destroys the stored tokens without deleting the account.

The catalog is disclosed rather than hidden: it is a cross-user store of
public SoundCloud metadata, and Finding C is why it survives in that form.

## Finding B — delete within 7 days after disconnect

> TERMS: _[paste the disconnect/revocation deletion clause verbatim]_

**Substance.** When a user disconnects **or otherwise revokes access**, data
obtained through the API for that user must be deleted within seven days.
Revocation counts even when the user never opens this app — that is the part
that drove most of this branch.

**What this branch does.**

| Requirement | Mechanism |
|---|---|
| A disconnect action exists | `POST /api/auth/disconnect` → `disconnectUser()` |
| Revocation is noticed without the user telling us | `invalid_grant` at the refresh choke point runs the same teardown with `reason: 'revoked'` |
| Credentials go immediately | `tokens` row deleted, auth memo invalidated, library caches and durable snapshots dropped — synchronous, not deferred to the job |
| Everything else within 7 days | retention step 2: `users.disconnectedAt < now - 7d` → `user.deleteMany`, cascading to operation logs, growth actions, votes, cache pages |
| Coming back does not get you deleted | a successful OAuth callback sets `lastLoginAt` and clears `disconnectedAt` |

The seven days are spent as a grace period, not a delay: the API-derived data
is already unreachable the moment the tokens go, and the window exists only so
a reconnect within the week restores the account instead of starting over.
**The window is a constant in `server/lib/retention.js`
(`DISCONNECTED_GRACE_DAYS = 7`), not an env var** — it should not be possible
to push it past the deadline from a deployment dashboard.

Residual risk: the job runs daily, so the worst case is 7 days plus up to one
interval. That is inside the deadline, but if `RETENTION_INTERVAL_MS` is ever
raised the margin shrinks. Treat the interval as compliance-relevant, not a
tuning knob.

## Finding C — caching is session-based only

> TERMS: _[paste the caching / no-separate-database clause verbatim]_

**Substance.** SoundCloud content may be cached only for the duration of the
user's session and only as needed to operate the application, and a separate
database of SoundCloud content may not be built or maintained. This is the
restrictive reading question 1 anticipated, and it is **narrower than a fixed
TTL** — it also answers question 3.

**What this branch does, and what it does not.**

- The library cache (`library_cache_pages` / `library_cache_states`) is now
  bounded: retention step 1 deletes rows older than `CACHE_TTL_DAYS` (7).
  Seven days is longer than a session, so **this is not yet compliant** — it
  is bounded where it used to be unbounded. Session scope means tying eviction
  to the session TTL; that work is not done here.
- The **catalog** (`tracks` / `playlists`) is the "separate database of
  SoundCloud content" this finding names. Question 3's own conclusion applies:
  do not run the backfill, drop the admin aggregate view, and either drop the
  catalog or narrow it to a per-request cache. **The backfill remains unrun
  and its flag default-off.** The catalog is not removed by this branch, and
  that is a known gap — not an argument that it is permitted.
- Operation-log metadata retains touched-ID arrays. Retention step 4 purges
  logs older than `OPLOG_RETENTION_DAYS` (365), which bounds it, and
  snapshots the distinct-user count first so the all-time figure survives
  without keeping the rows.

**Still open after this branch:** session-scoped (not 7-day) library-cache
eviction; the catalog's existence and the admin aggregate view built on it.

## Finding D — reflect upstream removals

> TERMS: _[paste the upstream-removal clause verbatim]_

**Substance.** When content is removed from SoundCloud or made private, the
application must reflect that and remove cached copies. This answers question
2 in the negative, exactly as question 2 predicted: *"retaining last-known
metadata under a `'gone'` flag is exactly the retention the clause prohibits —
the flag does not change what is stored."*

**What this branch does.** Retention step 8 strips the metadata from `gone`
rows on every run:

```
track.updateMany({
  where: { access: 'gone', title: { not: null } },
  data: { title: null, artistName: null, genre: null,
          genreNormalized: null, permalinkUrl: null },
})
```

What survives is the numeric SoundCloud ID and the `gone` status — the opaque
tombstone question 2 allowed for, with no cached content attached. Historical
operation logs still resolve; aggregate views lose deleted tracks from their
trends, which question 2 said to accept rather than argue against.

The complementary half is unchanged: `server/lib/enrichment.js` marks rows
`gone` when `GET /tracks?ids=` stops returning them, and re-resolution clears
the flag if a track reappears. **That detection is piggyback-only** — it runs
during a user's operations, so a track nobody touches can stay stale
indefinitely. A background availability sweep would fix the latency but is
itself service-operator activity under Finding C, which is why it is still not
built. This is a real gap in "reflect that change", not a solved problem.

## Summary

| Finding | Status after this branch |
|---|---|
| A — privacy policy | Export, delete and disconnect all exist and work |
| B — 7-day deletion after disconnect | **Met**, with revocation detected automatically |
| C — session-only caching, no separate database | **Partially addressed**: caches bounded, backfill still unrun; catalog and admin aggregate remain open |
| D — reflect upstream removals | **Metadata now stripped**; detection latency remains a gap |

Nothing here changes the standing instruction on the backfill: it stays off.
