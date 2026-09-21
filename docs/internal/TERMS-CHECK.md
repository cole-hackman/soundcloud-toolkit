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
