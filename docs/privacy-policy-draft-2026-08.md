# Privacy Policy — Draft Wording, August 2026

> **DRAFT — NOT PUBLISHED.** This is proposed replacement wording for the live
> privacy page (`frontend-UI/src/app/privacy/page.tsx`), written for developer
> review before the operation-analytics / metadata-catalog branch ships. Do not
> copy any of this into the live page until the feature branch is actually
> deployed and the SoundCloud API terms questions in `TERMS-CHECK.md` are
> resolved.
> **SUPERSEDED 2026-08-25** — the live privacy page now covers beta-email
> collection and product-usage analytics. Kept for history; do not edit.

## What this draft replaces or extends

| Live section | What happens to it |
|---|---|
| **Product Usage & Interaction Analytics** | Extended — replaced by Section A below, which spells out that operated-resource IDs are captured per operation |
| **Product Usage Analytics** (the "lightweight usage events" section) | Removed and folded into Section A. Its current claim that usage events "do not include SoundCloud track names" would become false once the metadata catalog exists; keeping both sections would be contradictory |
| **Data Usage** | Amended — Section B below. Two of the current "We do not" bullets ("Analyze your listening habits or preferences" and "Store your playlist content or track information beyond what's necessary for API calls") are no longer true once the catalog and aggregate trend analysis exist, and must be removed or rewritten as shown |
| *(new)* **Track & Playlist Metadata Catalog** | Added — Section C below |
| **Data Retention** | Replaced — Section D below, adding the in-app account-deletion right |
| **Your Rights** | Minor edit — the "Request deletion of your data" bullet becomes "Delete your account and all associated data directly from the app" |

All other sections (Authentication, Data We Access, Cookies, Third-Party
Services, Security Measures, etc.) are unchanged.

---

## Section A — Product Usage & Operation Analytics (replacement text)

To maintain application health, diagnose API issues, and plan product
improvements, we log details about each operation a signed-in user runs:

- **User identification.** Each log entry records your internal account ID and
  your numeric SoundCloud ID. Operation logs are keyed to your account — they
  are not anonymous.
- **Operated resources.** Each entry records the SoundCloud IDs of the tracks,
  playlists, and users the operation touched — for example, the track IDs you
  bulk-unliked, the playlist IDs you merged, or the user IDs you unfollowed.
  This lets us verify and audit batch operations and understand which features
  handle what volume.
- **Performance and diagnostics.** We record execution duration, operation
  status (success, split, error), and error codes.
- **Client environment.** We capture lightweight environment metadata (device
  type, browser name, OS platform) from the request user-agent.

We never collect or store your SoundCloud password, IP addresses, audio files,
private messages, track comments, or financial data.

## Section B — Data Usage (amended text)

We use your data to:

- Provide playlist management features (merge, organize, modify playlists)
- Convert your liked tracks into playlists
- Resolve SoundCloud links to extract metadata
- Maintain your session while using the application
- Improve the product, including analyzing — in aggregate, across all users —
  which tracks, artists, and genres pass through the app's operations (see
  the Metadata Catalog section)

We do **not**:

- Sell, rent, or share your data with any third party
- Use your data for advertising or marketing
- Show any individual user's activity to anyone other than that user; the
  aggregate views described below are accessible only to the developer

> Removed from the live text: "Analyze your listening habits or preferences"
> and "Store your playlist content or track information beyond what's
> necessary for API calls." Both would be untrue after this change and cannot
> stay in the policy.

## Section C — Track & Playlist Metadata Catalog (new section)

When your operations touch SoundCloud tracks or playlists, we store their
**public metadata** in a catalog keyed by SoundCloud ID: title, artist name
and ID, genre, duration, and availability status (playable, preview-only,
blocked, or removed from SoundCloud).

- The catalog contains only metadata that SoundCloud already exposes publicly
  through its API. We do not store audio, download files, private tracks,
  private playlists, messages, or comments.
- Catalog rows describe the track or playlist itself, not you. A catalog row
  is shared reference data and is not tied to a single user's account.
  (Which tracks *your* operations touched is recorded separately in your
  operation logs, described above.)
- To fill in missing fields, the app may look up tracks via SoundCloud's API
  (`GET /tracks?ids=...`) **using your own OAuth authorization** — the same
  access you already granted for the app's core features. Enrichment does not
  request any additional permissions.
- The catalog and the aggregate views over it are used for product improvement
  and for aggregate music-trend analysis by the developer (for example, which
  genres or artists are most common across all users' operations). Access to
  these views is admin-only. We do not sell, publish, or share the catalog or
  any analysis of it with third parties.

## Section D — Data Retention & Account Deletion (replacement text)

- **Account data and tokens** are retained while your account exists.
- **Operation logs** (including the resource IDs your operations touched) are
  retained while the service operates, and deleted when you delete your
  account.
- **Catalog rows** (public track/playlist metadata) are retained while the
  service operates. Because they are shared reference data about public
  SoundCloud content and are not tied to a single user, they are not removed
  when an individual account is deleted.

You can:

- **Log out** — clears your session; account data remains.
- **Revoke access in your SoundCloud settings** — prevents any future access
  to your SoundCloud account by this app.
- **Delete your account from within the app.** This permanently deletes
  everything keyed to your account: your user record, your encrypted access
  and refresh tokens, your complete operation history (including all logged
  track/playlist/user IDs), growth-feature actions, and survey and beta-signup
  responses (including any email you provided). This is immediate and cannot
  be undone. It does not remove shared catalog rows, which are public metadata
  not associated with your account.
