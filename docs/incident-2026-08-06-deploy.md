# Investigation: the August 6 deploy and three failure signatures

**Question:** do the three failure clusters in the 72 hours after the Aug 6 deploy — clone dying entirely, bulk-unlike/unfollow all-items-failed bursts, bulk-like silent failures — share a root cause?

**Answer: no single root cause. One genuine deploy regression (clone) plus two failure modes the deploy made visible but did not create.** The deploy changed **zero** code in the per-item execution path of the bulk operations — the loops in the deployed tip (`b879cdb`) are byte-identical to the pre-window state (`9d7ce93`); only the surrounding `logOperation` calls changed. `soundcloud-client.js`'s request/retry/refresh logic and all middleware were untouched in the window (the only client change, `49368e7`, added `getAllPlaylists`).

## Signature 1 — clone: deploy regression. Confidence: HIGH. Fixed in this branch.

`dcb4d21` (authored Jul 26, first deployed Aug 6) introduced four references to an undefined `source` variable in the clone route's logging calls (the defined variable is `sourceId`). The ReferenceError fires after the playlist is created on SoundCloud, so every clone since the deploy created the playlist, returned a 500, and logged nothing. **Attribution correction to DATA-COLLECTION.md §0:** the bug came from `dcb4d21`, not `42bf56a` (whose diff contains no clone hunks).

**User impact — duplicate playlists:** a user who retried saw "Failed to clone playlist" while each attempt actually created the playlist. They'd find the duplicates in their SoundCloud library as multiple identically-titled "Clone of <name>" playlists created seconds apart, all with the "Cloned from <url>" description this app writes. No automated cleanup is included (deliberately — nothing in this branch deletes user playlists).

## Signature 2 — bulk-unlike/unfollow all-fail bursts: pre-existing mode, made visible. Confidence: MODERATE (visibility), with the mechanism now evidence-narrowed.

Before `dcb4d21`, an all-fail batch logged `status: 'success'` with zero counts (verified in the removed lines of its diff) — these events were invisible before Aug 6, so their appearance right after the deploy is exactly what turning on the instrument predicts.

The mechanism can't be proven from code (per-item errors were discarded), but the new `durationMs` values discriminate the candidates: token-refresh failure costs ~1–1.5 s/item, SC 429-retry exhaustion ~3.5+ s/item, and fast-fail 404 on an already-processed item ~0.3–0.5 s/item. **The observed all-fail batches ran at ~0.27–0.42 s/item** (unfollow: 13–21 s per 50; unlike: 31–43 s per 100) — the 404 signature. Combined with the overlapping same-second success/error batch pairs and the frontend's 50-per-chunk loop that continues past failures, the best-supported story is **re-submission of already-unfollowed/unliked IDs from a stale or duplicated selection** (two tabs, or a list resurrected by SoundCloud's eventually-consistent reads). Users' actual cleanups mostly succeeded; the "failures" were mostly no-ops.

## Signature 3 — bulk-like 0-of-100 trains: not deploy-caused; most likely an SC-side like quota. Confidence: MODERATE.

The route and `likeTrack` are unchanged since Jul 12. The batches were ~8 minutes apart, and spacing ≈ batch duration for this client loop: 100 items × (3 × ~1 s 429 retries + 150 ms pacing + latency) ≈ 6–8 minutes — consistent with every item exhausting 429 retries after SoundCloud cut the user off mid-run. It logged 'success' because the route hardcoded it; that logging gap is fixed in this branch.

## What this branch changed so the next occurrence is diagnosable

All-items-failed outcomes on bulk routes now log `status: 'error'`, `errorCode: 'ALL_ITEMS_FAILED'`, and the first per-item error message. A 404-burst, a token failure, and a 429 quota will now be distinguishable by reading one row.

## Side findings from the same investigation

- `dcb4d21` also swapped auth.js's `safeError` import for `logOperation` while leaving five `safeError()` call sites — a latent ReferenceError on any auth-route error. Fixed in this branch.
- Production's `operation_logs` table lacked the new diagnostic columns until the migration was applied mid-day Aug 6; in that window, writes that included the new fields failed silently. Expect some missing rows early on Aug 6.
