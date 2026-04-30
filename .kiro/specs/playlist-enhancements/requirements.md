# Requirements Document

## Introduction

This document defines the requirements for the Playlist Enhancements feature set of the SoundCloud Toolkit. The enhancements cover four capabilities: merging playlists into an existing playlist, deleting source playlists after a successful merge, adding liked tracks to an existing playlist, and searching tracks by genre/tag filters. These requirements are derived from the approved design document.

## Glossary

- **Merge_Endpoint**: The backend route `POST /api/playlists/merge` responsible for combining tracks from multiple source playlists into a single target playlist
- **From_Likes_Endpoint**: The backend route `POST /api/playlists/from-likes` responsible for creating or appending liked tracks to a playlist
- **Delete_Endpoint**: The backend route `DELETE /api/playlists/:id` responsible for deleting a user-owned playlist via the SoundCloud API
- **Search_Endpoint**: The backend route `GET /api/tracks/search` responsible for searching SoundCloud tracks by genre, tag, and other filters
- **SoundCloudClient**: The server-side client class that communicates with the SoundCloud API
- **Target_Playlist**: An existing user-owned playlist that receives merged or appended tracks
- **Source_Playlist**: A user-owned playlist whose tracks are being merged into a target
- **Track_Cap**: The SoundCloud-imposed limit of 500 tracks per playlist
- **Overflow_Playlist**: A new playlist created to hold tracks that exceed the 500-track cap on the target playlist
- **Deduplication**: The process of removing duplicate track IDs so each track appears at most once in the output
- **Combine_Page**: The frontend page at `/combine` where users merge playlists
- **Likes_Page**: The frontend page at `/likes-to-playlist` where users convert liked tracks into playlists
- **Genre_Search_Page**: The new frontend page at `/genre-search` for searching tracks by genre and tag

## Requirements

### Requirement 1: Merge Playlists into an Existing Playlist

**User Story:** As a SoundCloud power user, I want to merge multiple playlists into an existing playlist, so that I can consolidate tracks without creating a new playlist every time.

#### Acceptance Criteria

1. WHEN a merge request includes a `targetPlaylistId`, THE Merge_Endpoint SHALL fetch the Target_Playlist tracks and all Source_Playlist tracks, deduplicate them by track ID, and append the new unique tracks to the Target_Playlist via `PUT /playlists/{targetId}`
2. WHEN a merge request does not include a `targetPlaylistId`, THE Merge_Endpoint SHALL create a new playlist using the provided `title`, preserving the existing behavior
3. THE Merge_Endpoint SHALL preserve the original track order of the Target_Playlist and append new tracks after the existing tracks
4. WHEN the combined deduplicated track count exceeds 500, THE Merge_Endpoint SHALL fill the Target_Playlist to 500 tracks and create Overflow_Playlists for the remaining tracks, each containing at most 500 tracks
5. THE Merge_Endpoint SHALL return a `stats` object containing `existingTrackCount`, `addedCount`, and `finalCount` when merging into an existing playlist
6. WHEN `targetPlaylistId` appears in `sourcePlaylistIds`, THE Merge_Endpoint SHALL reject the request with a 400 status code before making any SoundCloud API calls

### Requirement 2: Delete Source Playlists After Merge

**User Story:** As a SoundCloud power user, I want to optionally delete source playlists after a successful merge, so that I can clean up my library without manual effort.

#### Acceptance Criteria

1. WHEN `deleteAfterMerge` is set to `true` and the merge operation succeeds, THE Merge_Endpoint SHALL delete each Source_Playlist by calling `DELETE /playlists/{id}` on the SoundCloud API
2. THE Merge_Endpoint SHALL exclude the Target_Playlist from deletion even if its ID appears in `sourcePlaylistIds`
3. WHEN one or more Source_Playlist deletions fail, THE Merge_Endpoint SHALL return the successful merge result along with a `deleteErrors` array listing each failed playlist ID and error message
4. THE Merge_Endpoint SHALL attempt Source_Playlist deletions sequentially with a 300ms delay between each call to respect rate limits
5. WHEN `deleteAfterMerge` is absent or `false`, THE Merge_Endpoint SHALL not attempt any playlist deletions

### Requirement 3: Delete Playlist Endpoint

**User Story:** As a SoundCloud power user, I want a dedicated endpoint to delete a playlist, so that the frontend can trigger playlist deletion independently.

#### Acceptance Criteria

1. WHEN a valid playlist ID is provided, THE Delete_Endpoint SHALL call `DELETE /playlists/{id}` on the SoundCloud API and return `{ ok: true }` on success
2. IF the SoundCloud API returns an error for the deletion request, THEN THE Delete_Endpoint SHALL return an error response with the appropriate HTTP status code and error message
3. THE Delete_Endpoint SHALL validate that the playlist ID is a positive integer before making any SoundCloud API calls

### Requirement 4: Add Liked Tracks to an Existing Playlist

**User Story:** As a SoundCloud power user, I want to add selected liked tracks to an existing playlist, so that I can organize my likes into my current playlists without creating new ones.

#### Acceptance Criteria

1. WHEN a from-likes request includes a `targetPlaylistId`, THE From_Likes_Endpoint SHALL fetch the Target_Playlist tracks, deduplicate against the provided `trackIds`, and append new unique tracks to the Target_Playlist
2. WHEN a from-likes request does not include a `targetPlaylistId`, THE From_Likes_Endpoint SHALL create a new playlist using the provided `title`, preserving the existing behavior
3. WHEN the combined deduplicated track count exceeds 500, THE From_Likes_Endpoint SHALL fill the Target_Playlist to 500 tracks and create Overflow_Playlists for the remaining tracks
4. THE From_Likes_Endpoint SHALL return `addedCount` indicating the number of net new tracks added after deduplication
5. WHEN all provided `trackIds` already exist in the Target_Playlist, THE From_Likes_Endpoint SHALL return `addedCount` of 0 and leave the Target_Playlist unchanged

### Requirement 5: Track Search by Genre and Tags

**User Story:** As a SoundCloud power user, I want to search for tracks by genre and tag filters, so that I can discover new music matching specific criteria and add it to my playlists.

#### Acceptance Criteria

1. WHEN at least one of `genres`, `tags`, or `q` is provided, THE Search_Endpoint SHALL proxy the request to the SoundCloud `GET /tracks` API with the corresponding filter parameters
2. THE Search_Endpoint SHALL return a response containing a `collection` array of normalized track objects and an optional `next_href` for pagination
3. WHEN `bpm_from` and `bpm_to` are both provided, THE Search_Endpoint SHALL validate that `bpm_from` is less than or equal to `bpm_to` and reject invalid ranges with a 400 status code
4. WHEN `duration_from` and `duration_to` are both provided, THE Search_Endpoint SHALL validate that `duration_from` is less than or equal to `duration_to` and reject invalid ranges with a 400 status code
5. THE Search_Endpoint SHALL enforce a maximum `limit` of 200 results per request, defaulting to 50 when not specified
6. WHEN none of `genres`, `tags`, or `q` is provided, THE Search_Endpoint SHALL reject the request with a 400 status code

### Requirement 6: SoundCloudClient Extension

**User Story:** As a developer, I want the SoundCloudClient to support playlist deletion and track search, so that the new endpoints can communicate with the SoundCloud API.

#### Acceptance Criteria

1. THE SoundCloudClient SHALL provide a `deletePlaylist` method that accepts an access token, refresh token, and playlist ID, and calls `DELETE /playlists/{id}` on the SoundCloud API
2. THE SoundCloudClient SHALL provide a `searchTracks` method that accepts an access token, refresh token, and search parameters, and calls `GET /tracks` on the SoundCloud API with the provided filters
3. WHEN the SoundCloud API returns a 401 during a `deletePlaylist` or `searchTracks` call, THE SoundCloudClient SHALL refresh the access token and retry the request once

### Requirement 7: Input Validation

**User Story:** As a developer, I want all new and extended endpoints to validate input before processing, so that invalid requests are rejected early and no unnecessary SoundCloud API calls are made.

#### Acceptance Criteria

1. THE Merge_Endpoint SHALL validate that `sourcePlaylistIds` is a non-empty array of positive integers with at most 20 elements
2. THE Merge_Endpoint SHALL validate that `targetPlaylistId`, when provided, is a positive integer
3. THE From_Likes_Endpoint SHALL validate that `trackIds` is a non-empty array of positive integers with at most 5000 elements
4. THE Search_Endpoint SHALL validate that `genres` and `tags` are strings of at most 200 characters each
5. THE Search_Endpoint SHALL validate that `bpm_from` and `bpm_to` are integers between 1 and 300 when provided
6. THE Search_Endpoint SHALL validate that `limit` is an integer between 1 and 200 when provided
7. WHEN validation fails for any endpoint, THE system SHALL return a 400 status code with a descriptive error message before making any SoundCloud API calls

### Requirement 8: Combine Page Enhancement

**User Story:** As a SoundCloud power user, I want the Combine Playlists page to offer a choice between creating a new playlist and merging into an existing one, so that I can pick the workflow that suits me.

#### Acceptance Criteria

1. THE Combine_Page SHALL display a toggle allowing the user to choose between "Create new playlist" and "Add to existing playlist" modes
2. WHEN "Add to existing playlist" mode is selected, THE Combine_Page SHALL display a playlist picker dropdown populated with the user's playlists, excluding any playlists already selected as sources
3. WHEN "Add to existing playlist" mode is selected, THE Combine_Page SHALL hide the "Playlist Name" input field
4. THE Combine_Page SHALL display a "Delete source playlists after merge" checkbox, disabled by default
5. WHEN the delete checkbox is checked and the user initiates a merge, THE Combine_Page SHALL display a confirmation dialog listing the playlists that will be deleted
6. WHEN the merge completes with deletions, THE Combine_Page SHALL display the list of deleted playlists and any deletion errors in the success screen

### Requirement 9: Likes-to-Playlist Page Enhancement

**User Story:** As a SoundCloud power user, I want the Likes-to-Playlist page to offer an option to add tracks to an existing playlist, so that I can append liked tracks to my current playlists.

#### Acceptance Criteria

1. THE Likes_Page SHALL display a toggle allowing the user to choose between "Create new playlist" and "Add to existing playlist" modes
2. WHEN "Add to existing playlist" mode is selected, THE Likes_Page SHALL display a playlist picker dropdown populated with the user's playlists
3. WHEN "Add to existing playlist" mode is selected, THE Likes_Page SHALL hide the "Playlist Name" input field
4. WHEN the user submits in "Add to existing playlist" mode, THE Likes_Page SHALL send the request with `targetPlaylistId` to the From_Likes_Endpoint

### Requirement 10: Genre Search Page

**User Story:** As a SoundCloud power user, I want a dedicated page to search tracks by genre and tags, so that I can discover music and add it to my playlists.

#### Acceptance Criteria

1. THE Genre_Search_Page SHALL provide input fields for genre (with common genre suggestions), tags (free-form comma-separated), and optional advanced filters for BPM range and duration range
2. WHEN the user submits a search, THE Genre_Search_Page SHALL call the Search_Endpoint and display results in a grid of track cards showing artwork, title, artist, and duration
3. WHEN search results include a `next_href`, THE Genre_Search_Page SHALL display a "Load more" button that fetches the next page of results
4. THE Genre_Search_Page SHALL allow the user to select tracks from the results and add them to a new or existing playlist via the From_Likes_Endpoint
5. WHEN the search returns an empty `collection`, THE Genre_Search_Page SHALL display an empty state suggesting the user try different filters
