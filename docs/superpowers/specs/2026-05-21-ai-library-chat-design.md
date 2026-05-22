# SoundCloud Toolkit — AI Library Chat (v1 Spec)

**Date:** 2026-05-21
**Status:** Approved for planning

## Goal

A streaming chat assistant that answers natural-language questions about a
user's SoundCloud library — e.g. "How many liked tracks by Riordan?", "Which
playlists overlap most?", "List my Tech House likes" — by querying a pre-built
per-user index through OpenAI tool calling. OAuth tokens never leave the server;
the LLM never sees raw credentials. The server always mediates SoundCloud
access, exactly as it does today.

## Architecture

```
ChatUI (SSE stream) ──▶ POST /api/chat ──▶ OpenAI (tool-calling loop)
                              │                  │
                              │             tool calls
                              ▼                  ▼
                        Library Index  ◀──  Server tools (read-only)
                        (Postgres)           │ fall back to live SC
                              ▲              ▼
                        Sync job ──▶ soundcloud-client.js ──▶ SoundCloud
```

The agent answers from the **index** first (instant). Tools fall back to live
SoundCloud only when the index is stale or lacks a needed field.

## Data Model (new Prisma models)

- **`LibrarySnapshot`** — `userId` (FK, unique), `likesSyncedAt`,
  `playlistsSyncedAt`, `status` (`fresh | syncing | stale | error`),
  `likeCount`, `playlistCount`.
- **`IndexedLike`** — `userId`, `trackId`, `title`, `artistName`, `artistId`,
  `genre`, `genreNormalized`, `tagList`, `durationMs`, `createdAt`.
  Indexed on `(userId, artistName)` and `(userId, genreNormalized)`.
- **`IndexedPlaylistTrack`** — `userId`, `playlistId`, `playlistTitle`,
  `trackId`. Indexed on `(userId, playlistId)` for fast pairwise overlap.

Genre is normalized on write (lowercase, trimmed, whitespace collapsed) into
`genreNormalized` so "Tech House" / "tech house" / "techhouse" match.

## Sync Job

- `POST /api/library/sync` — triggers an async rebuild. Sets `status=syncing`,
  paginates likes + playlists via existing `soundcloud-client.js` (reusing the
  300ms inter-batch delays and `heavyOperationRateLimiter`), upserts rows,
  stamps timestamps, sets `status=fresh`.
- **Triggers:** on first chat when no snapshot exists; on demand via a "Refresh
  library" button; opportunistically when `>24h` stale.
- Chat works during a sync using whatever is already indexed, and discloses that
  the data is partial.
- On error, sets `status=error` and surfaces a retry path; partial index is
  retained rather than wiped.

## Chat Endpoint — `POST /api/chat`

- Auth via `authenticateUser`. Rate-limited by a new `chatRateLimiter`
  (30 messages/hour) plus `heavyOperationRateLimiter` on any tool that hits live
  SoundCloud.
- Server-Sent Events stream: assistant tokens plus `tool_status` events
  (e.g. "Scanning 4,812 likes…").
- Runs the OpenAI tool-calling loop server-side. Caps: max 6 tool calls per
  turn; max live-SC pages per turn bounded to protect against abuse.
- System prompt: answer **only** from tool results, cite counts and track IDs,
  state when data is partial or stale, never invent tracks.
- OpenAI access sits behind a thin provider interface so the model/provider can
  be swapped later without touching endpoint logic.

## v1 Tool Set (all read-only, index-backed with live fallback)

| Tool | Backed by |
|---|---|
| `get_me_stats` | `/api/me` |
| `search_likes` (artist, genre, q, limit) | `IndexedLike` |
| `count_likes` (group by artist or genre) | `IndexedLike` aggregate |
| `list_playlists` | `IndexedPlaylistTrack` / `/api/playlists` |
| `compare_playlists` (pair) | existing `comparePlaylists` |
| `find_top_overlapping_playlists` | precomputed pairwise from index |
| `library_audit_summary` | existing `/library/audit` |
| `resolve_url` | existing resolve |

## Chat UI

- New tool route in the `(app)` route group, plus a launcher in `AppShell`.
- Streamed responses with a live tool-status line.
- Result cards for tracks/playlists that **deep-link into existing tools**
  (e.g. "open these in Like Manager" with the filter pre-applied).
- "Refresh library" control showing `likesSyncedAt`.

## Guardrails & Risks

- Per-user chat rate limit + per-turn tool/page caps prevent SoundCloud-load
  abuse.
- Genre coverage is imperfect (SoundCloud metadata gaps) → answers disclose
  coverage limits.
- Privacy: update the privacy policy to disclose that queries are sent to
  OpenAI. `OPENAI_API_KEY` is a server-only env var.
- Hallucination guard via system prompt and requiring tool-sourced IDs.

## Out of Scope for v1

Write actions (create playlist / bulk-unlike from chat), multi-account, voice,
and cross-session conversation persistence.

## Environment Variables (new)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Server-only key for the chat provider |
| `CHAT_MODEL_SIMPLE` | No | Model for simple turns (default per provider) |
| `CHAT_MODEL_REASONING` | No | Model for multi-tool reasoning turns |
