# AI Library Chat v1.5 — Expanded Capabilities

## Context

The v1 build (already merged to `feature/ai-library-chat`) shipped a streaming
chat assistant backed by a per-user library index, with 3 read-only tools
(`count_likes`, `search_likes`, `find_top_overlapping_playlists`). It has no
write actions, no deep-linked result cards, no chat persistence, and exact-only
genre matching. This plan adds those five capabilities in a single coherent
v1.5, sequenced cheap → costly so each phase ships independently and dependent
work waits on its prerequisites.

Order rationale:
- **Phase A** (genre matching) first — write actions like *"unlike all Tech
  House"* are unsafe without it.
- **Phase B** (rest of tool table) next — pure switch-case additions; broadens
  question coverage immediately.
- **Phase C** (deep-link cards) before persistence, because it changes the
  shape of tool-result events that persistence will store.
- **Phase D** (chat history) before write actions, because confirm-action UX
  benefits from session continuity ("yes, do it").
- **Phase E** (write actions) last — highest blast radius; depends on C and B.

---

## Phase A — Smarter genre matching (Goal #5)

**Why first:** correctness on "list Tech House likes" determines whether
write actions like "create a Tech House playlist" or "unlike all Tech House"
operate on the right tracks. Today `searchLikes` only does an exact
case-sensitive substring match on `genreNormalized`, which misses common
aliases ("dnb" ↔ "drum and bass") and tracks where the genre lives in
`tag_list` rather than `genre`.

**Existing reusable code:**
- `server/lib/genre-utils.js#normalizeGenre` — canonical normalization.
- `server/lib/library-index.js#searchLikes` — current query reader.
- `IndexedLike.tagList` column — already populated by `mapLikeToRow`
  (`server/lib/library-index-map.js:25`).

**Tasks:**
- **A1.** New pure module `server/lib/genre-aliases.js` exporting
  `expandGenreAliases(input)` → returns an array of normalized aliases for an
  input (e.g. `"dnb"` → `["drum and bass", "dnb"]`, `"tech house"` → `["tech
  house", "techhouse"]`). Curated alias map keyed by normalized form.
- **A2.** Extend `searchLikes(userId, { artist, genre, q, limit }, deps)` so a
  `genre` filter:
  1. Expands via `expandGenreAliases` to a list of candidate normalized
     genres.
  2. Builds a Prisma `OR` clause that matches `genreNormalized` against any
     candidate **or** `tagList` (case-insensitive substring) against any
     candidate.
- **A3.** Extend `tests/library-index.test.js` fakePrisma to support `where.OR`
  and tagList filtering, plus new test cases:
  - `"DnB"` finds tracks indexed with genre `"drum and bass"`.
  - A track with `genre: null, tag_list: "tech house, dark"` is found by
    `genre: "Tech House"`.

**Files:** `server/lib/genre-aliases.js` (new), `tests/genre-aliases.test.js`
(new), `server/lib/library-index.js` (modify `searchLikes`),
`tests/library-index.test.js` (extend).

---

## Phase B — Complete the spec's tool table (Goal #3)

**Why:** the v1 spec listed 8 tools; v1 shipped 3. Each remaining tool is a
new `case` in `dispatchTool` wired to logic that already lives in the
codebase. Broadens what the agent can answer with minimal new code.

**Existing reusable code:**
- `soundcloudClient.getMe(accessToken, refreshToken)` —
  `server/lib/soundcloud-client.js:182`.
- `server/lib/playlist-compare.js#comparePlaylists` — already used by
  `POST /api/playlists/compare` at `server/routes/api.js:331`.
- `server/lib/library-audit.js#summarizeLibraryAudit` — used by
  `GET /api/library/audit` at `server/routes/api.js:296`.
- The resolve handler at `server/routes/api.js:832` — extract its core into a
  helper.

**Tasks:**
- **B1.** Extend `dispatchTool(name, args, ctx)` to thread `accessToken` and
  `refreshToken` through `ctx`. Update the chat route to pass them.
- **B2.** New tool `get_me_stats` — calls `soundcloudClient.getMe(...)` and
  returns `{ username, displayName, followers_count, followings_count,
  likes_count, playlist_count, track_count }`. No live SoundCloud paging.
- **B3.** New tool `compare_playlists({ playlistAId, playlistBId })` — fetches
  both via `soundcloudClient.getPlaylistWithTracks`, runs `comparePlaylists`,
  returns the `summary` object only (no full track arrays — keeps the LLM
  context cheap).
- **B4.** New tool `library_audit_summary` — fetches `getPlaylists` page +
  `getPlaylistWithTracks` (capped to e.g. 20 playlists), runs
  `summarizeLibraryAudit`, returns `audit.summary` only.
- **B5.** New tool `resolve_url({ url })` — extract the resolve handler core
  into `server/lib/resolve-soundcloud-url.js` so both the route and the tool
  reuse it. Returns the normalized metadata object.
- **B6.** New tool `list_playlists({ limit?: number })` — reads
  `IndexedPlaylistTrack` distinct `(playlistId, playlistTitle)` for the user,
  falls back to `soundcloudClient.getPlaylists` if the index is empty. Returns
  `[{ id, title, trackCount }]`.
- **B7.** Extend `CHAT_TOOL_DEFINITIONS` with five OpenAI function schemas.
  Extend `tests/chat-tools.test.js` with one dispatch test per tool using
  injected fakes.

**Files:** `server/lib/chat-tools.js` (extend), `server/routes/chat.js`
(thread tokens into ctx), `server/lib/resolve-soundcloud-url.js` (new — extract
from `api.js`), `server/routes/api.js` (refactor to use the new helper),
`tests/chat-tools.test.js` (extend), `tests/resolve-soundcloud-url.test.js`
(new pure-function tests).

---

## Phase C — Structured tool results + deep-link cards (Goal #2)

**Why before D:** persistence will store the tool-result shape, so we should
finalize that shape first.

**Tasks (backend):**
- **C1.** Every tool return is wrapped in a standard envelope. Add a new pure
  module `server/lib/chat-deep-links.js` exporting `buildDeepLink(kind, args)`
  → URL string (e.g. `buildDeepLink('like-manager-filter', { artist: 'Riordan',
  genre: 'tech house' })` → `'/like-manager?artist=Riordan&genre=tech house'`).
  Pure, unit-tested.
- **C2.** Tool results now include `display: { kind, ...payload }`:
  - `search_likes` → `{ kind: 'tracks', tracks: [...], deepLink: ... }`
  - `compare_playlists` → `{ kind: 'playlist_pair', deepLink: ... }`
  - `find_top_overlapping_playlists` → `{ kind: 'playlist_pairs', pairs:
    [{ ..., deepLink }] }`
  - `list_playlists` → `{ kind: 'playlists', items: [...] }`
  - Tools without a useful card (counts, audit, stats) omit `display`.

**Tasks (frontend):**
- **C3.** Modify `frontend-UI/src/app/(app)/like-manager/page.tsx` to read
  `?artist=…&genre=…&q=…` via `useSearchParams` on mount and pre-apply those
  filters to whatever existing client-side filter state it has.
- **C4.** Modify `frontend-UI/src/app/(app)/playlist-compare/page.tsx` to read
  `?a=<id>&b=<id>`, pre-populate the two selectors, and auto-trigger compare.
- **C5.** New component
  `frontend-UI/src/components/chat/ToolResultCard.tsx` that switches on
  `display.kind` and renders the appropriate card with "Open in …" buttons
  pointing at the `deepLink`.
- **C6.** Extend `frontend-UI/src/lib/useLibraryChat.ts`: collect each
  `tool_result` event into a per-message `toolResults: []` array exposed in
  the returned state. Library-chat page renders those above the final
  assistant text via `ToolResultCard`.

**Files:** `server/lib/chat-deep-links.js` (new), `server/lib/chat-tools.js`
(wrap returns with `display`), `tests/chat-deep-links.test.js` (new), 2
frontend pages modified, 1 new component, 1 hook modified.

---

## Phase D — Persistent chat history (Goal #4)

**Why before E:** write-action confirmation UX wants session continuity ("yes,
go ahead"); persistence also gives users a way to return to long answers.

**Schema (add to `prisma/schema.prisma`):**

```prisma
model ChatConversation {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  messages  ChatMessage[]

  @@index([userId, updatedAt])
  @@map("chat_conversations")
}

model ChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String   // 'user' | 'assistant' | 'tool'
  content        String?  @db.Text
  toolName       String?
  toolArgs       Json?
  toolResult     Json?
  createdAt      DateTime @default(now())

  @@index([conversationId, createdAt])
  @@map("chat_messages")
}
```

Add `chatConversations ChatConversation[]` to the existing `User` model.

**Endpoints (extend `server/routes/chat.js`):**
- **D1.** `GET /api/chat/conversations` → list (id, title, updatedAt) for the
  authenticated user, ordered by `updatedAt desc`.
- **D2.** `POST /api/chat/conversations` → create empty, return id.
- **D3.** `GET /api/chat/conversations/:id` → full message list.
- **D4.** `DELETE /api/chat/conversations/:id`.
- **D5.** Modify `POST /api/chat` to accept `{ conversationId, messages }`.
  When `conversationId` is provided:
  - Verify ownership.
  - Persist the new user turn before streaming.
  - On completion, persist the assistant text + a `tool` row per tool call
    (with `toolName`, `toolArgs`, `toolResult`).
  - Auto-set the conversation `title` to the first user message's first ~60
    chars if `title` is null.

**Pure persistence helpers (testable):** put DB I/O behind
`server/lib/chat-history.js` exporting `listConversations`,
`getConversation`, `createConversation`, `appendUserMessage`,
`appendAssistantTurn`, `deleteConversation` — each accepting `{ prisma }` for
test injection. Unit-test with a fake prisma the same pattern as
`tests/library-index.test.js`.

**Frontend (modify `library-chat/page.tsx` + `useLibraryChat.ts`):**
- **D6.** Sidebar listing conversations + "New chat" + per-row delete.
- **D7.** URL: `/library-chat?c=<id>` (or `/library-chat/[id]` if route group
  refactor is cheap). On mount, if `c` is set, fetch and replay messages.
- **D8.** Hook gains `conversationId`, `loadConversation(id)`, `startNew()`.
  `send` posts `{ conversationId, messages }` so the server can persist.

**Files:** `prisma/schema.prisma` (add 2 models + 1 User relation),
`server/lib/chat-history.js` (new), `tests/chat-history.test.js` (new),
`server/routes/chat.js` (extend), `frontend-UI/src/app/(app)/library-chat/page.tsx`
(modify), `frontend-UI/src/lib/useLibraryChat.ts` (modify).

---

## Phase E — Write actions with confirmation (Goal #1)

**Why last:** highest blast radius. Depends on C (cards render the confirm
UX) and B (tool ctx threading).

**Design principle: the agent never mutates SoundCloud directly.** Tools
return a *proposal* envelope; the UI renders a Confirm card; clicking Confirm
calls the *existing* mutation endpoints with the captured payload. The agent
cannot bypass user consent because it has no mutating tool.

**Existing reusable endpoints (no new mutation routes needed):**
- `POST /api/playlists/from-likes` → creates a playlist (auto-split at 500),
  `server/routes/api.js:1603`.
- `POST /api/likes/tracks/bulk-unlike` → batch unlike up to 100,
  `server/routes/api.js:1928`.

**New proposal tools in `server/lib/chat-tools.js`:**
- **E1.** `propose_create_playlist_from_tracks({ trackIds, title })` →
  validates `trackIds.length >= 1`; returns
  ```
  { display: { kind: 'proposal',
               action: 'create_playlist',
               endpoint: '/api/playlists/from-likes',
               method: 'POST',
               payload: { trackIds, title },
               summary: `Create playlist "${title}" with ${trackIds.length} tracks?` } }
  ```
  Does **not** call SoundCloud.
- **E2.** `propose_bulk_unlike({ trackIds })` → validates `1 <= length <=
  100`; returns a `proposal` envelope targeting `/api/likes/tracks/bulk-unlike`
  with a human-readable summary that counts tracks.
- **E3.** Optional `propose_bulk_unfollow` if scope allows (wraps existing
  `/api/followings/bulk-unfollow`).

**System prompt change (`server/lib/chat-prompt.js`):**
Add explicit instructions: *"When a user asks you to create, delete, or
modify anything, call one of the `propose_*` tools — never claim you
performed the action. The user will explicitly confirm in the UI before
anything changes."*

**Frontend:**
- **E4.** Extend `ToolResultCard` to recognize `display.kind === 'proposal'`
  and render a danger-styled Confirm button + a Cancel button. Confirm makes
  the actual mutation `fetch(payload.endpoint, { method, credentials,
  body: JSON.stringify(payload.payload) })`, shows progress, and on success:
  1. Calls `POST /api/library/sync` to refresh the index.
  2. Renders the mutation response inline.
- **E5.** Persist proposal cards in chat history (Phase D) as
  `toolResult.display`, with a `confirmedAt` field updated client-side when
  the user confirms — so reopening a conversation shows historic decisions.

**Files:** `server/lib/chat-tools.js` (add 2-3 tools + envelopes),
`server/lib/chat-prompt.js` (system-prompt update),
`tests/chat-tools.test.js` (add proposal tests),
`frontend-UI/src/components/chat/ToolResultCard.tsx` (extend).

---

## Critical files (modified or created)

**New backend:**
- `server/lib/genre-aliases.js`
- `server/lib/chat-deep-links.js`
- `server/lib/resolve-soundcloud-url.js`
- `server/lib/chat-history.js`

**Modified backend:**
- `server/lib/library-index.js` (Phase A)
- `server/lib/chat-tools.js` (Phases B, C, E)
- `server/lib/chat-prompt.js` (Phase E)
- `server/routes/chat.js` (Phases B, D)
- `server/routes/api.js` (Phase B refactor)
- `prisma/schema.prisma` (Phase D)

**New frontend:**
- `frontend-UI/src/components/chat/ToolResultCard.tsx`

**Modified frontend:**
- `frontend-UI/src/app/(app)/library-chat/page.tsx` (C, D)
- `frontend-UI/src/lib/useLibraryChat.ts` (C, D)
- `frontend-UI/src/app/(app)/like-manager/page.tsx` (C)
- `frontend-UI/src/app/(app)/playlist-compare/page.tsx` (C)

**New tests:**
- `tests/genre-aliases.test.js`
- `tests/chat-deep-links.test.js`
- `tests/chat-history.test.js`
- `tests/resolve-soundcloud-url.test.js`

**Extended tests:**
- `tests/library-index.test.js` (Phase A)
- `tests/chat-tools.test.js` (Phases B, C, E)

---

## Verification

**Per-phase gate (run after each phase commits):**
- `npm test` — all suites pass.
- `cd frontend-UI && npx tsc --noEmit` — clean (ignoring the pre-existing
  `@vercel/speed-insights` error in `app/layout.tsx`).

**End-to-end checks (with `OPENAI_API_KEY` set, `npm run dev`):**

1. **Phase A** — Ask *"List my Tech House likes"*. Confirm matches include
   tracks tagged via aliases and via `tag_list`, not only ones with
   `genre='Tech House'`.
2. **Phase B** — Ask each: *"What are my stats?"*, *"Compare playlist X and
   Y"*, *"Audit my library"*, *"What's at &lt;sc.com URL&gt;?"*, *"List my
   playlists"*. Each should invoke its new tool and answer from real data
   (verify tool name in the `tool_status` stream events).
3. **Phase C** — A *"List my Tech House likes"* answer renders track cards
   with an *Open in Like Manager* button. Click → Like Manager opens with the
   filter pre-applied. *"Compare A and B"* result has *Open Comparison* button
   that opens `/playlist-compare?a=…&b=…` with the compare already running.
4. **Phase D** — Start a chat, ask a question, refresh the page. Sidebar
   shows the conversation with an auto-title. Click it → messages restore
   verbatim. Delete it → it disappears. Start a new chat from sidebar — empty
   panel.
5. **Phase E** — Ask *"Make a playlist from my Tech House likes called Test
   v1.5"*. A Confirm card appears with the track count. Click Confirm. After
   the existing endpoint succeeds, the new playlist appears in your SoundCloud
   account. Re-sync runs automatically; snapshot updates. Repeat for *"Unlike
   those tracks"* with a small deliberately-disposable test set first.
6. **No token leakage** — In DevTools → Network → the `/api/chat` SSE stream,
   confirm no `access_token` or `refresh` strings appear anywhere.

---

## Out of scope for v1.5

- Embedding-based genre similarity (curated alias map only).
- Multi-account support.
- Cross-conversation memory/recall by the agent (each conversation is
  isolated; the agent does not search prior conversations).
- Agent-initiated background tasks.
- Voice input/output.
- Result-card embeds for tracks (just deep links).
