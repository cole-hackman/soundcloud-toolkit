# Implementation Plan: Playlist Enhancements

## Overview

Extend the SoundCloud Toolkit with four capabilities: merge into existing playlists, delete source playlists after merge, add likes to existing playlists, and genre/tag track search. Implementation proceeds backend-first (SoundCloudClient → validation → endpoints), then frontend (enhance existing pages → new genre search page → dashboard update), with property-based tests alongside each component.

## Tasks

- [x] 1. Extend SoundCloudClient with new methods
  - [x] 1.1 Add `deletePlaylist(accessToken, refreshToken, playlistId)` method to `server/lib/soundcloud-client.js`
    - Call `DELETE /playlists/{id}` via `scRequest` (automatic 401 retry already handled)
    - _Requirements: 6.1, 6.3_
  - [x] 1.2 Add `searchTracks(accessToken, refreshToken, params)` method to `server/lib/soundcloud-client.js`
    - Build query string from params (genres, tags, q, bpm_from, bpm_to, duration_from, duration_to, limit, offset)
    - Call `GET /tracks?{params}&linked_partitioning=1` via `scRequest`
    - Return `{ collection, next_href }`
    - _Requirements: 6.2, 6.3_
  - [ ]* 1.3 Write unit tests for `deletePlaylist` and `searchTracks`
    - Mock `scRequest` and verify correct endpoint/method/params
    - _Requirements: 6.1, 6.2_

- [ ] 2. Add merge utility functions and validation
  - [x] 2.1 Extend `server/lib/merge-utils.js` with `mergeIntoExisting(existingIds, sourceIds)` function
    - Takes existing track ID array and source track ID array
    - Returns `{ mergedIds, addedCount }` where mergedIds preserves existing order and appends new unique tracks
    - _Requirements: 1.1, 1.3_
  - [ ]* 2.2 Write property test for deduplication correctness (Property 1)
    - **Property 1: Deduplication correctness** — for any existing IDs and source IDs, output size equals `|Set(existing) ∪ Set(source)|` with each ID appearing exactly once
    - **Validates: Requirements 1.1, 4.1**
  - [ ]* 2.3 Write property test for order preservation (Property 2)
    - **Property 2: Order preservation** — first N elements of merged result equal original existing IDs in same order
    - **Validates: Requirement 1.3**
  - [ ]* 2.4 Write property test for 500-track splitting (Property 3)
    - **Property 3: 500-track splitting** — for any N tracks, splitting produces `ceil(N/500)` playlists, each ≤500 tracks, sum equals N
    - **Validates: Requirements 1.4, 4.3**
  - [ ]* 2.5 Write property test for stats consistency (Property 4)
    - **Property 4: Stats consistency** — `addedCount` equals `finalCount - existingTrackCount`
    - **Validates: Requirements 1.5, 4.4**
  - [ ]* 2.6 Write property test for idempotent append (Property 5)
    - **Property 5: Idempotent append** — when all new IDs already exist in target, `addedCount` is 0 and output equals input
    - **Validates: Requirement 4.5**

- [x] 3. Add input validation for new/extended endpoints
  - [x] 3.1 Extend `validateMergePlaylists` in `server/middleware/validation.js`
    - Add optional `targetPlaylistId` (positive integer)
    - Add optional `deleteAfterMerge` (boolean)
    - Increase `sourcePlaylistIds` max from 10 to 20
    - Make `title` required only when `targetPlaylistId` is absent
    - Validate `targetPlaylistId ∉ sourcePlaylistIds` (Requirement 1.6)
    - _Requirements: 7.1, 7.2, 1.6_
  - [x] 3.2 Extend `validateCreateFromLikes` in `server/middleware/validation.js`
    - Add optional `targetPlaylistId` (positive integer)
    - Increase `trackIds` max from 2000 to 5000
    - Make `title` required only when `targetPlaylistId` is absent
    - _Requirements: 7.3_
  - [x] 3.3 Add `validateTrackSearch` validator in `server/middleware/validation.js`
    - Validate `genres` and `tags` as optional strings, max 200 chars each
    - Validate `bpm_from`/`bpm_to` as optional integers 1–300, `bpm_from ≤ bpm_to`
    - Validate `duration_from`/`duration_to` as optional integers, `duration_from ≤ duration_to`
    - Validate `limit` as optional integer 1–200
    - Require at least one of `genres`, `tags`, or `q`
    - _Requirements: 7.4, 7.5, 7.6, 7.7, 5.3, 5.4, 5.5, 5.6_
  - [x] 3.4 Add `validateDeletePlaylist` validator in `server/middleware/validation.js`
    - Validate `:id` param as positive integer
    - _Requirements: 3.3_
  - [ ]* 3.5 Write property tests for range parameter validation (Property 6)
    - **Property 6: Range parameter validation** — accepts when `from ≤ to` within bounds, rejects when `from > to` or out of bounds
    - **Validates: Requirements 5.3, 5.4, 7.5**
  - [ ]* 3.6 Write property tests for limit clamping (Property 7)
    - **Property 7: Limit clamping** — clamps to `min(limit, 200)`, defaults to 50, rejects < 1
    - **Validates: Requirements 5.5, 7.6**
  - [ ]* 3.7 Write property tests for array ID validation (Property 8)
    - **Property 8: Array ID validation** — accepts non-empty arrays of positive integers within max length, rejects all others
    - **Validates: Requirements 7.1, 7.3**
  - [ ]* 3.8 Write property test for string length validation (Property 9)
    - **Property 9: String length validation** — accepts strings ≤200 chars, rejects longer
    - **Validates: Requirement 7.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement backend endpoints
  - [x] 5.1 Enhance `POST /api/playlists/merge` in `server/routes/api.js`
    - When `targetPlaylistId` is provided: fetch target tracks, call `mergeIntoExisting`, append via `addTracksToPlaylist` in 100-track batches, handle 500-track overflow
    - When `deleteAfterMerge` is true: sequentially delete sources (excluding target) with 300ms delays, collect errors
    - Return extended stats with `existingTrackCount`, `addedCount`, `finalCount`, `deletedPlaylistIds`, `deleteErrors`
    - When `targetPlaylistId` is absent: preserve existing create-new behavior
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 5.2 Add `DELETE /api/playlists/:id` endpoint in `server/routes/api.js`
    - Use `validateDeletePlaylist` middleware
    - Call `soundcloudClient.deletePlaylist()`
    - Return `{ ok: true }` on success
    - Log operation
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 5.3 Enhance `POST /api/playlists/from-likes` in `server/routes/api.js`
    - When `targetPlaylistId` is provided: fetch target tracks, deduplicate against `trackIds`, append new unique tracks, handle 500-track overflow
    - Return `addedCount` in response
    - When `targetPlaylistId` is absent: preserve existing create-new behavior
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 5.4 Add `GET /api/tracks/search` endpoint in `server/routes/api.js`
    - Use `validateTrackSearch` middleware
    - Call `soundcloudClient.searchTracks()` with validated params
    - Normalize results using existing `normalizeResource`
    - Return `{ collection, next_href, total_results }`
    - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - [ ]* 5.5 Write integration tests for merge-into-existing flow
    - Mock SoundCloud API, test full merge with targetPlaylistId, verify dedup and stats
    - Test deleteAfterMerge with partial failure scenario
    - _Requirements: 1.1, 1.5, 2.1, 2.3_
  - [ ]* 5.6 Write integration tests for from-likes with targetPlaylistId
    - Mock SoundCloud API, test append to existing, verify addedCount and dedup
    - Test all-duplicates scenario returns addedCount 0
    - _Requirements: 4.1, 4.4, 4.5_
  - [ ]* 5.7 Write integration tests for track search endpoint
    - Mock SoundCloud API, test various filter combinations
    - Test pagination with next_href
    - _Requirements: 5.1, 5.2_

- [x] 6. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Enhance Combine Playlists page
  - [x] 7.1 Add merge mode toggle to `frontend-UI/src/app/(app)/combine/page.tsx`
    - Add state for `mergeMode` ("new" | "existing") with toggle UI
    - When "existing" is selected: show playlist picker dropdown (exclude selected sources), hide playlist name input
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 7.2 Add delete-after-merge checkbox and confirmation dialog
    - Add `deleteAfterMerge` checkbox (disabled by default)
    - On merge click with delete checked: show confirmation dialog listing playlists to be deleted
    - Send `targetPlaylistId` and `deleteAfterMerge` in merge request body
    - _Requirements: 8.4, 8.5_
  - [x] 7.3 Update success screen to show deletion results
    - Display list of deleted playlists and any deletion errors from response
    - _Requirements: 8.6_

- [x] 8. Enhance Likes-to-Playlist page
  - [x] 8.1 Add add-to-existing toggle to `frontend-UI/src/app/(app)/likes-to-playlist/page.tsx`
    - Add state for `addMode` ("new" | "existing") with toggle UI
    - When "existing" is selected: show playlist picker dropdown, hide playlist name input
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 8.2 Update API call to support `targetPlaylistId`
    - When addMode is "existing", send `{ trackIds, targetPlaylistId }` instead of `{ trackIds, title }`
    - Update success screen to reflect "added to" vs "created" messaging
    - _Requirements: 9.4_

- [x] 9. Create Genre Search page
  - [x] 9.1 Create `frontend-UI/src/app/(app)/genre-search/page.tsx`
    - Search form with genre input (with common genre suggestions: house, techno, ambient, hip-hop, etc.), tags input (comma-separated), optional BPM range and duration range filters
    - Submit calls `GET /api/tracks/search` with params
    - _Requirements: 10.1_
  - [x] 9.2 Implement search results grid and pagination
    - Display results as track cards (artwork, title, artist, duration)
    - "Load more" button when `next_href` is present
    - Empty state when collection is empty
    - _Requirements: 10.2, 10.3, 10.5_
  - [x] 9.3 Implement track selection and add-to-playlist action
    - Allow selecting tracks from results
    - "Add to playlist" button that calls `POST /api/playlists/from-likes` with selected track IDs
    - Support both "create new" and "add to existing" modes (reuse playlist picker pattern)
    - _Requirements: 10.4_

- [x] 10. Update Dashboard with Genre Search feature card
  - Add genre search entry to `FEATURES` array in `frontend-UI/src/app/(app)/dashboard/page.tsx`
  - Add corresponding entries to `RECENT_LABELS` and `RECENT_PATHS`
  - Use `Search` or `Music` icon from lucide-react
  - _Requirements: 10.1_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Backend is plain JavaScript (ES modules), frontend is TypeScript (Next.js 15)
- Tests use Jest with `NODE_OPTIONS=--experimental-vm-modules`
- The existing `createPlaylistFromTrackIds` helper in `api.js` can be reused for overflow playlist creation
