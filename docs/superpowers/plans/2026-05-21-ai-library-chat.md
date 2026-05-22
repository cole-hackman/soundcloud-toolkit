# AI Library Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a streaming chat assistant that answers natural-language questions about a user's SoundCloud library by querying a persistent per-user Postgres index through OpenAI tool calling.

**Architecture:** A background sync job snapshots each user's likes and playlist track IDs into new Prisma tables. A new `POST /api/chat` endpoint runs an OpenAI tool-calling loop server-side, streaming results over SSE; tools read the index first and fall back to live SoundCloud. A new frontend chat page consumes the stream.

**Tech Stack:** Node/Express (ESM), Prisma + PostgreSQL, `openai` npm package, Jest (`NODE_OPTIONS=--experimental-vm-modules jest`, pure-function unit tests), Next.js 15 static export, TypeScript, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-21-ai-library-chat-design.md`

**Conventions to follow (verified in codebase):**
- Backend is ESM. Tests import from `../server/lib/...` and test **pure functions** (see `tests/playlist-compare.test.js`, `tests/library-audit.test.js`).
- Prisma client: `import prisma from '../lib/prisma.js'` (default export).
- Routes mounted in `server/index.js`: `app.use('/api', apiRoutes)`. Rate limiters from `server/middleware/rateLimiter.js` are no-ops in `NODE_ENV=development`.
- SC client methods: `getMe`, `getPlaylists(token, refresh, limit, offset)`, `getPlaylistWithTracks(token, refresh, id)`, `paginate(endpoint, token, refresh, limit)`.
- Frontend fetch base: `const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''`, all calls use `credentials: 'include'`.
- Run all backend tests with: `npm test`. Run one file with: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/<file>.test.js`.

---

## Phase 1 — Library Index: schema + pure mapping

### Task 1: Add Prisma models for the library index

**Files:**
- Modify: `prisma/schema.prisma` (also copy to `server/prisma/schema.prisma` if present — check first)

- [ ] **Step 1: Add the three models and the User relations**

Append to `prisma/schema.prisma`:

```prisma
model LibrarySnapshot {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status           String   @default("stale") // 'fresh' | 'syncing' | 'stale' | 'error'
  likeCount        Int      @default(0)
  playlistCount    Int      @default(0)
  likesSyncedAt    DateTime?
  playlistsSyncedAt DateTime?
  error            String?
  updatedAt        DateTime @updatedAt

  @@unique([userId])
  @@map("library_snapshots")
}

model IndexedLike {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trackId         Int
  title           String?
  artistName      String?
  artistId        Int?
  genre           String?
  genreNormalized String?
  tagList         String?
  durationMs      Int?
  likedAt         DateTime?

  @@unique([userId, trackId])
  @@index([userId, artistName])
  @@index([userId, genreNormalized])
  @@map("indexed_likes")
}

model IndexedPlaylistTrack {
  id            String @id @default(cuid())
  userId        String
  user          User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  playlistId    Int
  playlistTitle String?
  trackId       Int

  @@unique([userId, playlistId, trackId])
  @@index([userId, playlistId])
  @@map("indexed_playlist_tracks")
}
```

Then add these relation fields inside the existing `model User { ... }` block, next to `tokens` and `operationLogs`:

```prisma
  librarySnapshot      LibrarySnapshot?
  indexedLikes         IndexedLike[]
  indexedPlaylistTracks IndexedPlaylistTrack[]
```

- [ ] **Step 2: Verify schema is valid and generate the client**

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" and "Generated Prisma Client".

- [ ] **Step 3: Push schema to the dev database**

Run: `npx prisma db push`
Expected: tables `library_snapshots`, `indexed_likes`, `indexed_playlist_tracks` created; "Your database is now in sync".

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma server/prisma/schema.prisma 2>/dev/null; git add prisma/schema.prisma
git commit -m "feat(chat): add library index Prisma models"
```

---

### Task 2: Genre normalization utility (pure)

**Files:**
- Create: `server/lib/genre-utils.js`
- Test: `tests/genre-utils.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/genre-utils.test.js
import { normalizeGenre } from '../server/lib/genre-utils.js';

describe('normalizeGenre', () => {
  test('lowercases, trims, collapses whitespace', () => {
    expect(normalizeGenre('  Tech   House ')).toBe('tech house');
  });
  test('strips non-alphanumeric separators so techhouse matches tech house variants', () => {
    expect(normalizeGenre('Tech-House')).toBe('tech house');
    expect(normalizeGenre('Tech/House')).toBe('tech house');
  });
  test('returns null for empty or non-string input', () => {
    expect(normalizeGenre('')).toBeNull();
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre(42)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/genre-utils.test.js`
Expected: FAIL — "Cannot find module '../server/lib/genre-utils.js'".

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/lib/genre-utils.js
/**
 * Normalize a genre/tag string for fuzzy matching.
 * Lowercases, replaces non-alphanumerics with spaces, collapses whitespace.
 * Returns null for empty/non-string input.
 */
export function normalizeGenre(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/genre-utils.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/genre-utils.js tests/genre-utils.test.js
git commit -m "feat(chat): add genre normalization util"
```

---

### Task 3: Map a SoundCloud like object to an index row (pure)

**Files:**
- Create: `server/lib/library-index-map.js`
- Test: `tests/library-index-map.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/library-index-map.test.js
import { mapLikeToRow, mapPlaylistTracksToRows } from '../server/lib/library-index-map.js';

const like = {
  id: 555,
  title: 'Acid Trip',
  genre: 'Tech House',
  tag_list: 'dark warehouse',
  duration: 360000,
  created_at: '2024-01-02T03:04:05Z',
  user: { id: 99, username: 'riordan' },
};

describe('mapLikeToRow', () => {
  test('extracts indexed fields and normalizes genre', () => {
    expect(mapLikeToRow('user1', like)).toEqual({
      userId: 'user1',
      trackId: 555,
      title: 'Acid Trip',
      artistName: 'riordan',
      artistId: 99,
      genre: 'Tech House',
      genreNormalized: 'tech house',
      tagList: 'dark warehouse',
      durationMs: 360000,
      likedAt: new Date('2024-01-02T03:04:05Z'),
    });
  });

  test('handles like objects wrapped under a track property', () => {
    const wrapped = { track: like };
    expect(mapLikeToRow('user1', wrapped).trackId).toBe(555);
  });

  test('returns null when there is no track id', () => {
    expect(mapLikeToRow('user1', { title: 'no id' })).toBeNull();
  });
});

describe('mapPlaylistTracksToRows', () => {
  test('produces one row per track with playlist metadata', () => {
    const playlist = { id: 7, title: 'Mix', tracks: [{ id: 1 }, { id: 2 }, { id: 1 }] };
    const rows = mapPlaylistTracksToRows('user1', playlist);
    expect(rows).toEqual([
      { userId: 'user1', playlistId: 7, playlistTitle: 'Mix', trackId: 1 },
      { userId: 'user1', playlistId: 7, playlistTitle: 'Mix', trackId: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/library-index-map.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/lib/library-index-map.js
import { normalizeGenre } from './genre-utils.js';

/** SC like payloads are sometimes the track itself, sometimes { track: {...} }. */
function unwrapTrack(like) {
  if (like && typeof like === 'object' && like.track && typeof like.track === 'object') {
    return like.track;
  }
  return like;
}

/** Map a SoundCloud like/track object to an IndexedLike row, or null if no track id. */
export function mapLikeToRow(userId, like) {
  const track = unwrapTrack(like);
  const trackId = track?.id;
  if (typeof trackId !== 'number') return null;
  const genre = typeof track.genre === 'string' ? track.genre : null;
  return {
    userId,
    trackId,
    title: track.title ?? null,
    artistName: track.user?.username ?? null,
    artistId: typeof track.user?.id === 'number' ? track.user.id : null,
    genre,
    genreNormalized: normalizeGenre(genre),
    tagList: typeof track.tag_list === 'string' ? track.tag_list : null,
    durationMs: typeof track.duration === 'number' ? track.duration : null,
    likedAt: track.created_at ? new Date(track.created_at) : null,
  };
}

/** Map a playlist (with tracks) to deduplicated IndexedPlaylistTrack rows. */
export function mapPlaylistTracksToRows(userId, playlist) {
  const playlistId = playlist?.id;
  if (typeof playlistId !== 'number') return [];
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const seen = new Set();
  const rows = [];
  for (const t of tracks) {
    const trackId = typeof t === 'number' ? t : t?.id;
    if (typeof trackId !== 'number' || seen.has(trackId)) continue;
    seen.add(trackId);
    rows.push({ userId, playlistId, playlistTitle: playlist.title ?? null, trackId });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/library-index-map.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/library-index-map.js tests/library-index-map.test.js
git commit -m "feat(chat): add pure SC->index row mappers"
```

---

### Task 4: Top-overlapping-playlists computation (pure)

**Files:**
- Create: `server/lib/playlist-overlap.js`
- Test: `tests/playlist-overlap.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/playlist-overlap.test.js
import { topOverlappingPlaylists } from '../server/lib/playlist-overlap.js';

// rows shape matches IndexedPlaylistTrack: { playlistId, playlistTitle, trackId }
const rows = [
  { playlistId: 1, playlistTitle: 'A', trackId: 10 },
  { playlistId: 1, playlistTitle: 'A', trackId: 11 },
  { playlistId: 1, playlistTitle: 'A', trackId: 12 },
  { playlistId: 2, playlistTitle: 'B', trackId: 11 },
  { playlistId: 2, playlistTitle: 'B', trackId: 12 },
  { playlistId: 3, playlistTitle: 'C', trackId: 99 },
];

describe('topOverlappingPlaylists', () => {
  test('ranks pairs by shared track count with Jaccard percent', () => {
    const result = topOverlappingPlaylists(rows, { limit: 5 });
    expect(result[0]).toEqual({
      playlistA: { id: 1, title: 'A' },
      playlistB: { id: 2, title: 'B' },
      sharedTracks: 2,
      overlapPercent: 67, // 2 shared / 3 union
    });
  });

  test('omits pairs with zero overlap', () => {
    const result = topOverlappingPlaylists(rows, { limit: 5 });
    expect(result.some((p) => p.playlistB.id === 3 || p.playlistA.id === 3)).toBe(false);
  });

  test('respects the limit', () => {
    expect(topOverlappingPlaylists(rows, { limit: 1 })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/playlist-overlap.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```javascript
// server/lib/playlist-overlap.js
/**
 * Given flat IndexedPlaylistTrack rows, compute the most-overlapping playlist
 * pairs ranked by shared track count. overlapPercent is Jaccard (|A∩B|/|A∪B|).
 * Pairs with zero overlap are omitted.
 */
export function topOverlappingPlaylists(rows, { limit = 10 } = {}) {
  const byPlaylist = new Map(); // id -> { title, tracks:Set }
  for (const row of rows) {
    let entry = byPlaylist.get(row.playlistId);
    if (!entry) {
      entry = { title: row.playlistTitle ?? null, tracks: new Set() };
      byPlaylist.set(row.playlistId, entry);
    }
    entry.tracks.add(row.trackId);
  }

  const ids = [...byPlaylist.keys()];
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = byPlaylist.get(ids[i]);
      const b = byPlaylist.get(ids[j]);
      let shared = 0;
      for (const t of a.tracks) if (b.tracks.has(t)) shared++;
      if (shared === 0) continue;
      const union = a.tracks.size + b.tracks.size - shared;
      pairs.push({
        playlistA: { id: ids[i], title: a.title },
        playlistB: { id: ids[j], title: b.title },
        sharedTracks: shared,
        overlapPercent: union ? Math.round((shared / union) * 100) : 0,
      });
    }
  }

  pairs.sort((x, y) => y.sharedTracks - x.sharedTracks || y.overlapPercent - x.overlapPercent);
  return pairs.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/playlist-overlap.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/playlist-overlap.js tests/playlist-overlap.test.js
git commit -m "feat(chat): add top-overlapping-playlists computation"
```

---

## Phase 2 — Index sync + query layer

### Task 5: Library index store (sync writers + query readers)

This module touches Prisma, so we inject the prisma client for the unit test and default to the real one in production.

**Files:**
- Create: `server/lib/library-index.js`
- Test: `tests/library-index.test.js`

- [ ] **Step 1: Write the failing test (uses an in-memory fake prisma)**

```javascript
// tests/library-index.test.js
import { searchLikes, countLikesByArtist } from '../server/lib/library-index.js';

function fakePrisma(likes) {
  return {
    indexedLike: {
      findMany: async ({ where, take }) => {
        let rows = likes;
        if (where?.userId) rows = rows.filter((r) => r.userId === where.userId);
        if (where?.artistName?.contains) {
          const q = where.artistName.contains.toLowerCase();
          rows = rows.filter((r) => (r.artistName || '').toLowerCase().includes(q));
        }
        if (where?.genreNormalized?.contains) {
          const q = where.genreNormalized.contains;
          rows = rows.filter((r) => (r.genreNormalized || '').includes(q));
        }
        return take ? rows.slice(0, take) : rows;
      },
    },
  };
}

const likes = [
  { userId: 'u1', trackId: 1, title: 'A', artistName: 'Riordan', genreNormalized: 'tech house' },
  { userId: 'u1', trackId: 2, title: 'B', artistName: 'Riordan', genreNormalized: 'house' },
  { userId: 'u1', trackId: 3, title: 'C', artistName: 'Other', genreNormalized: 'tech house' },
  { userId: 'u2', trackId: 4, title: 'D', artistName: 'Riordan', genreNormalized: 'tech house' },
];

describe('library-index query readers', () => {
  test('searchLikes filters by artist within the user scope', async () => {
    const res = await searchLikes('u1', { artist: 'riordan' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId).sort()).toEqual([1, 2]);
  });

  test('searchLikes filters by normalized genre', async () => {
    const res = await searchLikes('u1', { genre: 'Tech House' }, { prisma: fakePrisma(likes) });
    expect(res.map((r) => r.trackId).sort()).toEqual([1, 3]);
  });

  test('countLikesByArtist returns count and sample', async () => {
    const res = await countLikesByArtist('u1', 'Riordan', { prisma: fakePrisma(likes) });
    expect(res.count).toBe(2);
    expect(res.sample.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/library-index.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/library-index.js
import defaultPrisma from './prisma.js';
import { normalizeGenre } from './genre-utils.js';
import { mapLikeToRow, mapPlaylistTracksToRows } from './library-index-map.js';
import { topOverlappingPlaylists } from './playlist-overlap.js';
import { soundcloudClient } from './soundcloud-client.js';
import logger from './logger.js';
import { safeError } from './safe-error.js';

const STALE_MS = 24 * 60 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Search indexed likes by artist substring and/or normalized genre. */
export async function searchLikes(userId, { artist, genre, q, limit = 50 } = {}, { prisma = defaultPrisma } = {}) {
  const where = { userId };
  if (artist) where.artistName = { contains: artist, mode: 'insensitive' };
  if (genre) where.genreNormalized = { contains: normalizeGenre(genre) || genre };
  if (q) where.title = { contains: q, mode: 'insensitive' };
  return prisma.indexedLike.findMany({ where, take: Math.min(limit, 200) });
}

/** Count indexed likes for an artist; returns { count, sample[] }. */
export async function countLikesByArtist(userId, artist, { prisma = defaultPrisma } = {}) {
  const rows = await searchLikes(userId, { artist, limit: 200 }, { prisma });
  return { count: rows.length, sample: rows.slice(0, 5) };
}

/** Count indexed likes for a genre; returns { count, sample[] }. */
export async function countLikesByGenre(userId, genre, { prisma = defaultPrisma } = {}) {
  const rows = await searchLikes(userId, { genre, limit: 200 }, { prisma });
  return { count: rows.length, sample: rows.slice(0, 5) };
}

/** Compute most-overlapping playlist pairs from indexed playlist tracks. */
export async function findTopOverlappingPlaylists(userId, { limit = 10 } = {}, { prisma = defaultPrisma } = {}) {
  const rows = await prisma.indexedPlaylistTrack.findMany({
    where: { userId },
    select: { playlistId: true, playlistTitle: true, trackId: true },
  });
  return topOverlappingPlaylists(rows, { limit });
}

/** Read the snapshot status row (or a default stale shape). */
export async function getSnapshot(userId, { prisma = defaultPrisma } = {}) {
  const snap = await prisma.librarySnapshot.findUnique({ where: { userId } });
  return snap || { userId, status: 'stale', likeCount: 0, playlistCount: 0, likesSyncedAt: null };
}

export function isStale(snapshot) {
  if (!snapshot || snapshot.status !== 'fresh' || !snapshot.likesSyncedAt) return true;
  return Date.now() - new Date(snapshot.likesSyncedAt).getTime() > STALE_MS;
}

/**
 * Rebuild a user's index from SoundCloud. Idempotent: clears and rewrites rows.
 * Reuses soundcloud-client pagination + a 300ms delay between playlist fetches.
 */
export async function syncLibrary(userId, accessToken, refreshToken, { prisma = defaultPrisma, sc = soundcloudClient } = {}) {
  await prisma.librarySnapshot.upsert({
    where: { userId },
    create: { userId, status: 'syncing' },
    update: { status: 'syncing', error: null },
  });

  try {
    // ---- Likes ----
    const likeItems = await sc
      .paginate('/me/likes/tracks', accessToken, refreshToken, 200)
      .catch(() => sc.paginate('/me/favorites', accessToken, refreshToken, 200));
    const likeRows = (likeItems || []).map((l) => mapLikeToRow(userId, l)).filter(Boolean);

    await prisma.indexedLike.deleteMany({ where: { userId } });
    if (likeRows.length) {
      await prisma.indexedLike.createMany({ data: likeRows, skipDuplicates: true });
    }
    await prisma.librarySnapshot.update({
      where: { userId },
      data: { likeCount: likeRows.length, likesSyncedAt: new Date() },
    });

    // ---- Playlists ----
    const page = await sc.getPlaylists(accessToken, refreshToken, 50, 0);
    const playlists = Array.isArray(page?.collection) ? page.collection : Array.isArray(page) ? page : [];
    const playlistRows = [];
    for (const p of playlists) {
      try {
        const full = await sc.getPlaylistWithTracks(accessToken, refreshToken, p.id);
        playlistRows.push(...mapPlaylistTracksToRows(userId, full));
      } catch (error) {
        logger.warn('Index playlist fetch failed:', { playlistId: p.id, error: safeError(error) });
      }
      await sleep(300);
    }

    await prisma.indexedPlaylistTrack.deleteMany({ where: { userId } });
    if (playlistRows.length) {
      await prisma.indexedPlaylistTrack.createMany({ data: playlistRows, skipDuplicates: true });
    }

    await prisma.librarySnapshot.update({
      where: { userId },
      data: { status: 'fresh', playlistCount: playlists.length, playlistsSyncedAt: new Date() },
    });

    return { likeCount: likeRows.length, playlistCount: playlists.length };
  } catch (error) {
    logger.error('Library sync failed:', safeError(error));
    await prisma.librarySnapshot.update({
      where: { userId },
      data: { status: 'error', error: String(error?.message || 'sync failed') },
    }).catch(() => {});
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/library-index.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/library-index.js tests/library-index.test.js
git commit -m "feat(chat): add library index sync + query layer"
```

---

## Phase 3 — Chat tools + provider

### Task 6: Tool definitions + dispatcher (pure dispatch, injected index)

**Files:**
- Create: `server/lib/chat-tools.js`
- Test: `tests/chat-tools.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/chat-tools.test.js
import { CHAT_TOOL_DEFINITIONS, dispatchTool } from '../server/lib/chat-tools.js';

describe('CHAT_TOOL_DEFINITIONS', () => {
  test('every tool has an OpenAI function schema', () => {
    for (const t of CHAT_TOOL_DEFINITIONS) {
      expect(t.type).toBe('function');
      expect(typeof t.function.name).toBe('string');
      expect(t.function.parameters.type).toBe('object');
    }
  });
});

describe('dispatchTool', () => {
  const ctx = {
    userId: 'u1',
    index: {
      countLikesByArtist: async (uid, artist) => ({ count: 7, sample: [{ trackId: 1, title: 'X' }] }),
      searchLikes: async () => [{ trackId: 1, title: 'X' }],
      findTopOverlappingPlaylists: async () => [{ playlistA: { id: 1 }, playlistB: { id: 2 }, sharedTracks: 3 }],
    },
  };

  test('routes count_likes (artist) to the index', async () => {
    const out = await dispatchTool('count_likes', { artist: 'Riordan' }, ctx);
    expect(out.count).toBe(7);
  });

  test('returns an error object for an unknown tool', async () => {
    const out = await dispatchTool('does_not_exist', {}, ctx);
    expect(out.error).toMatch(/unknown tool/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/chat-tools.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```javascript
// server/lib/chat-tools.js
import * as defaultIndex from './library-index.js';

/** OpenAI tool/function schemas exposed to the model (all read-only). */
export const CHAT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'count_likes',
      description: 'Count the user\'s liked tracks filtered by artist OR genre. Provide exactly one.',
      parameters: {
        type: 'object',
        properties: {
          artist: { type: 'string', description: 'Artist/username substring to match' },
          genre: { type: 'string', description: 'Genre name, e.g. "Tech House"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_likes',
      description: 'List the user\'s liked tracks matching artist, genre, and/or a free-text query.',
      parameters: {
        type: 'object',
        properties: {
          artist: { type: 'string' },
          genre: { type: 'string' },
          q: { type: 'string', description: 'Free-text match against track title' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_top_overlapping_playlists',
      description: 'Find which of the user\'s playlists share the most tracks.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 } },
      },
    },
  },
];

/**
 * Execute a tool by name. Returns a plain JSON-serializable result the model
 * can read. Never throws — errors are returned as { error } so the loop can continue.
 * ctx: { userId, index? } — index defaults to library-index module.
 */
export async function dispatchTool(name, args = {}, ctx = {}) {
  const index = ctx.index || defaultIndex;
  const userId = ctx.userId;
  try {
    switch (name) {
      case 'count_likes': {
        if (args.artist) return await index.countLikesByArtist(userId, args.artist);
        if (args.genre) return await index.countLikesByGenre(userId, args.genre);
        return { error: 'Provide either artist or genre.' };
      }
      case 'search_likes': {
        const rows = await index.searchLikes(userId, {
          artist: args.artist,
          genre: args.genre,
          q: args.q,
          limit: args.limit ?? 20,
        });
        return { count: rows.length, tracks: rows.slice(0, args.limit ?? 20) };
      }
      case 'find_top_overlapping_playlists': {
        const pairs = await index.findTopOverlappingPlaylists(userId, { limit: args.limit ?? 5 });
        return { pairs };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: String(error?.message || 'tool execution failed') };
  }
}
```

> **Note for the implementer:** Task 5's `countLikesByGenre` is referenced here — it exists. `find_top_overlapping_playlists`, `compare_playlists`, `library_audit_summary`, `get_me_stats`, and `resolve_url` from the spec's full tool table are added as follow-on tools in Task 6b once the loop works end-to-end; v1 ships the three highest-value tools first to validate the loop. Add the remaining tools by extending `CHAT_TOOL_DEFINITIONS` and the `switch`, wiring each to its existing endpoint logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/chat-tools.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/chat-tools.js tests/chat-tools.test.js
git commit -m "feat(chat): add tool definitions and dispatcher"
```

---

### Task 7: SSE event formatter (pure) + OpenAI provider wrapper

**Files:**
- Create: `server/lib/sse.js`
- Create: `server/lib/chat-provider.js`
- Test: `tests/sse.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/sse.test.js
import { formatSseEvent } from '../server/lib/sse.js';

describe('formatSseEvent', () => {
  test('formats a named event with JSON data and double newline', () => {
    expect(formatSseEvent('token', { text: 'hi' })).toBe('event: token\ndata: {"text":"hi"}\n\n');
  });
  test('escapes newlines inside data by JSON-encoding', () => {
    const out = formatSseEvent('token', { text: 'a\nb' });
    expect(out).toContain('data: {"text":"a\\nb"}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/sse.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementations**

```javascript
// server/lib/sse.js
/** Format a single Server-Sent Event frame. data is JSON-encoded. */
export function formatSseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
```

Install the OpenAI SDK first:

Run: `cd server && npm install openai && cd ..`
Expected: `openai` added to `server/package.json` dependencies.

```javascript
// server/lib/chat-provider.js
import OpenAI from 'openai';

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

const MODEL = process.env.CHAT_MODEL_REASONING || 'gpt-4o-mini';

/**
 * Create a streaming chat completion with tool calling.
 * Returns the async-iterable OpenAI stream. Provider is isolated here so it can
 * be swapped (e.g. Anthropic) without touching the route or the tool loop.
 */
export async function createChatStream({ messages, tools }) {
  return getClient().chat.completions.create({
    model: MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    stream: true,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/sse.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/lib/sse.js server/lib/chat-provider.js server/package.json server/package-lock.json
git commit -m "feat(chat): add SSE formatter and OpenAI provider wrapper"
```

---

## Phase 4 — Chat + sync endpoints

### Task 8: Add chatRateLimiter

**Files:**
- Modify: `server/middleware/rateLimiter.js`

- [ ] **Step 1: Add the limiter (after `heavyOperationRateLimiter`)**

```javascript
/**
 * Rate limiter for the AI chat endpoint.
 * Allows 30 chat messages per hour per IP. No-op in development.
 */
export const chatRateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    error: 'Too many chat requests, please slow down and try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

- [ ] **Step 2: Verify it imports cleanly**

Run: `cd server && node -e "import('./middleware/rateLimiter.js').then(m => console.log(typeof m.chatRateLimiter))" && cd ..`
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add server/middleware/rateLimiter.js
git commit -m "feat(chat): add chat rate limiter"
```

---

### Task 9: Sync route + system prompt builder

**Files:**
- Create: `server/lib/chat-prompt.js`
- Create: `server/routes/chat.js`
- Modify: `server/index.js` (mount router)
- Test: `tests/chat-prompt.test.js`

- [ ] **Step 1: Write the failing test for the system prompt builder**

```javascript
// tests/chat-prompt.test.js
import { buildSystemPrompt } from '../server/lib/chat-prompt.js';

describe('buildSystemPrompt', () => {
  test('includes snapshot freshness and the answer-only-from-tools rule', () => {
    const prompt = buildSystemPrompt({ status: 'fresh', likeCount: 4812, likesSyncedAt: '2026-05-21T00:00:00Z' });
    expect(prompt).toMatch(/4812/);
    expect(prompt).toMatch(/only.*tool/i);
  });
  test('warns when the index is still syncing', () => {
    const prompt = buildSystemPrompt({ status: 'syncing', likeCount: 100, likesSyncedAt: null });
    expect(prompt).toMatch(/partial|syncing/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/chat-prompt.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the system prompt builder**

```javascript
// server/lib/chat-prompt.js
/** Build the system prompt, embedding the user's index status for honesty about coverage. */
export function buildSystemPrompt(snapshot = {}) {
  const { status = 'stale', likeCount = 0, likesSyncedAt = null } = snapshot;
  const freshness =
    status === 'syncing'
      ? `The library index is still SYNCING and is PARTIAL right now (about ${likeCount} likes indexed so far). Tell the user results may be incomplete.`
      : status === 'fresh'
        ? `The library index is FRESH with ${likeCount} liked tracks (last synced ${likesSyncedAt}).`
        : `The library index may be STALE or empty (${likeCount} likes). Suggest the user refresh their library if results look incomplete.`;

  return [
    'You are the SoundCloud Toolkit library assistant.',
    'Answer questions about the user\'s SoundCloud library ONLY using the provided tools.',
    'Never invent track names, artists, counts, or playlists. Every factual claim must come from a tool result.',
    'When a count or list is requested, call the appropriate tool and cite the numbers it returns.',
    'Genre metadata from SoundCloud is often missing or inconsistent; when filtering by genre, note that results reflect only tracks with matching genre tags.',
    freshness,
  ].join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `NODE_OPTIONS=--experimental-vm-modules npx jest tests/chat-prompt.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the chat router (sync + chat endpoints)**

```javascript
// server/routes/chat.js
import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { chatRateLimiter, heavyOperationRateLimiter } from '../middleware/rateLimiter.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { logOperation } from '../lib/analytics.js';
import * as index from '../lib/library-index.js';
import { CHAT_TOOL_DEFINITIONS, dispatchTool } from '../lib/chat-tools.js';
import { createChatStream } from '../lib/chat-provider.js';
import { buildSystemPrompt } from '../lib/chat-prompt.js';
import { formatSseEvent } from '../lib/sse.js';

const router = express.Router();
const MAX_TOOL_CALLS_PER_TURN = 6;

/** GET /api/library/snapshot — current index status. */
router.get('/library/snapshot', authenticateUser, async (req, res) => {
  try {
    const snap = await index.getSnapshot(req.user.id);
    res.json({ ...snap, stale: index.isStale(snap) });
  } catch (error) {
    logger.error('Snapshot status error:', safeError(error));
    res.status(500).json({ error: 'Failed to read library status' });
  }
});

/** POST /api/library/sync — rebuild the index asynchronously. */
router.post('/library/sync', authenticateUser, heavyOperationRateLimiter, async (req, res) => {
  const snap = await index.getSnapshot(req.user.id);
  if (snap.status === 'syncing') return res.json({ status: 'syncing', alreadyRunning: true });

  // Fire-and-forget; client polls /library/snapshot.
  index
    .syncLibrary(req.user.id, req.accessToken, req.refreshToken)
    .then((r) => logOperation({ userId: req.user.id, action: 'library-sync', itemCount: r.playlistCount, trackCount: r.likeCount, status: 'success' }))
    .catch((error) => logger.error('Async sync failed:', safeError(error)));

  res.status(202).json({ status: 'syncing' });
});

/** POST /api/chat — streaming tool-calling chat over SSE. body: { messages: [{role, content}] } */
router.post('/chat', authenticateUser, chatRateLimiter, async (req, res) => {
  const userMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!userMessages.length) return res.status(400).json({ error: 'messages array is required' });

  // Trigger a background sync if the index has never been built.
  const snap = await index.getSnapshot(req.user.id);
  if (snap.status === 'stale' && snap.likeCount === 0) {
    index.syncLibrary(req.user.id, req.accessToken, req.refreshToken).catch((e) => logger.error('Lazy sync failed:', safeError(e)));
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => res.write(formatSseEvent(event, data));
  const messages = [
    { role: 'system', content: buildSystemPrompt(snap) },
    ...userMessages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
  ];

  try {
    let toolCallsUsed = 0;
    // Tool-calling loop: stream assistant text; when the model requests tools, run them and continue.
    for (let iteration = 0; iteration < MAX_TOOL_CALLS_PER_TURN + 1; iteration++) {
      const stream = await createChatStream({ messages, tools: CHAT_TOOL_DEFINITIONS });
      let assistantText = '';
      const toolCalls = []; // accumulate streamed tool_call deltas by index

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta || {};
        if (delta.content) {
          assistantText += delta.content;
          send('token', { text: delta.content });
        }
        for (const tc of delta.tool_calls || []) {
          const slot = (toolCalls[tc.index] ||= { id: '', name: '', args: '' });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name = tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
        }
      }

      if (!toolCalls.length) {
        send('done', { ok: true });
        break;
      }

      // Record the assistant's tool-call request, then execute each tool.
      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: t.args || '{}' } })),
      });

      for (const call of toolCalls) {
        if (toolCallsUsed >= MAX_TOOL_CALLS_PER_TURN) {
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'tool call budget exhausted' }) });
          continue;
        }
        toolCallsUsed++;
        let args = {};
        try { args = JSON.parse(call.args || '{}'); } catch { /* leave empty */ }
        send('tool_status', { name: call.name, args });
        const result = await dispatchTool(call.name, args, { userId: req.user.id, index });
        send('tool_result', { name: call.name, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    logOperation({ userId: req.user.id, action: 'chat', itemCount: toolCallsUsed, status: 'success' });
  } catch (error) {
    logger.error('Chat error:', safeError(error));
    send('error', { error: 'Chat failed. Please try again.' });
  } finally {
    res.end();
  }
});

export default router;
```

- [ ] **Step 6: Mount the router in `server/index.js`**

After the existing `import apiRoutes from './routes/api.js';` line (around line 101), add:

```javascript
import chatRoutes from './routes/chat.js';
```

After the existing `app.use('/api', apiRoutes);` line (around line 118), add:

```javascript
app.use('/api', chatRoutes);
```

- [ ] **Step 7: Verify the server boots and routes load**

Run: `cd server && node -e "import('./routes/chat.js').then(() => console.log('chat router OK'))" && cd ..`
Expected: prints `chat router OK` (no import errors).

- [ ] **Step 8: Run the full backend test suite**

Run: `npm test`
Expected: all suites pass, including the new genre/index/tools/sse/prompt tests.

- [ ] **Step 9: Commit**

```bash
git add server/lib/chat-prompt.js server/routes/chat.js server/index.js tests/chat-prompt.test.js
git commit -m "feat(chat): add sync + streaming chat SSE endpoints"
```

---

## Phase 5 — Frontend chat UI

### Task 10: SSE parsing hook

**Files:**
- Create: `frontend-UI/src/lib/useLibraryChat.ts`

- [ ] **Step 1: Write the hook**

```typescript
// frontend-UI/src/lib/useLibraryChat.ts
import { useCallback, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ToolStatus = { name: string; args: Record<string, unknown> } | null;

/** Streams a chat turn from POST /api/chat and parses the SSE frames. */
export function useLibraryChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [toolStatus, setToolStatus] = useState<ToolStatus>(null);
  const bufferRef = useRef('');

  const send = useCallback(async (text: string) => {
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);
    setToolStatus(null);

    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    if (!res.body) { setStreaming(false); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    bufferRef.current = '';

    const applyEvent = (event: string, data: string) => {
      const payload = JSON.parse(data);
      if (event === 'token') {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + payload.text };
          return next;
        });
      } else if (event === 'tool_status') {
        setToolStatus({ name: payload.name, args: payload.args });
      } else if (event === 'tool_result' || event === 'done') {
        setToolStatus(null);
      } else if (event === 'error') {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: payload.error };
          return next;
        });
      }
    };

    // Parse SSE: events separated by blank lines; lines prefixed with "event:" / "data:".
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bufferRef.current += decoder.decode(value, { stream: true });
      const frames = bufferRef.current.split('\n\n');
      bufferRef.current = frames.pop() || '';
      for (const frame of frames) {
        const lines = frame.split('\n');
        const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim() || 'message';
        const data = lines.find((l) => l.startsWith('data:'))?.slice(5).trim() || '{}';
        try { applyEvent(event, data); } catch { /* ignore malformed frame */ }
      }
    }
    setStreaming(false);
    setToolStatus(null);
  }, [messages]);

  return { messages, streaming, toolStatus, send };
}
```

- [ ] **Step 2: Type-check the frontend**

Run: `cd frontend-UI && npx tsc --noEmit && cd ..`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-UI/src/lib/useLibraryChat.ts
git commit -m "feat(chat): add SSE chat hook"
```

---

### Task 11: Chat page + nav entry

**Files:**
- Create: `frontend-UI/src/app/(app)/library-chat/page.tsx`
- Modify: `frontend-UI/src/components/AppShell.tsx` (add nav item)

- [ ] **Step 1: Add the nav item in `AppShell.tsx`**

In the `Discovery` group's `items` array (currently containing `genre-search`), add after the Genre Search entry:

```typescript
      { href: "/library-chat", label: "Library Chat", icon: MessageSquare },
```

Add `MessageSquare` to the existing `lucide-react` import at the top of the file (alongside `Music`, `LayoutDashboard`, etc.).

- [ ] **Step 2: Create the chat page**

```tsx
// frontend-UI/src/app/(app)/library-chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useLibraryChat } from "@/lib/useLibraryChat";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type Snapshot = { status: string; likeCount: number; likesSyncedAt: string | null; stale: boolean };

export default function LibraryChatPage() {
  const { messages, streaming, toolStatus, send } = useLibraryChat();
  const [input, setInput] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const loadSnapshot = async () => {
    const res = await fetch(`${API_BASE}/api/library/snapshot`, { credentials: "include" });
    if (res.ok) setSnapshot(await res.json());
  };
  useEffect(() => { loadSnapshot(); }, []);

  const refresh = async () => {
    await fetch(`${API_BASE}/api/library/sync`, { method: "POST", credentials: "include" });
    loadSnapshot();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    send(input.trim());
    setInput("");
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Library Chat</h1>
          <p className="text-sm text-muted-foreground">
            Ask about your likes, playlists, and genres.
          </p>
        </div>
        <button onClick={refresh} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
          Refresh library
        </button>
      </header>

      {snapshot && (
        <p className="text-xs text-muted-foreground">
          {snapshot.status === "syncing"
            ? "Indexing your library…"
            : `Indexed ${snapshot.likeCount} likes${snapshot.likesSyncedAt ? ` · updated ${new Date(snapshot.likesSyncedAt).toLocaleString()}` : ""}`}
        </p>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
        {messages.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Try: “How many liked tracks by Riordan?” · “List my Tech House likes” · “Which playlists overlap the most?”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span className={`inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
            </span>
          </div>
        ))}
        {toolStatus && (
          <div className="text-xs text-muted-foreground">Running {toolStatus.name}…</div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your library…"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          disabled={streaming}
        />
        <button type="submit" disabled={streaming || !input.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build the frontend**

Run: `cd frontend-UI && npx tsc --noEmit && npm run build && cd ..`
Expected: type check passes; static export build succeeds with the new `/library-chat` route.

- [ ] **Step 4: Commit**

```bash
git add "frontend-UI/src/app/(app)/library-chat/page.tsx" frontend-UI/src/components/AppShell.tsx
git commit -m "feat(chat): add library chat page and nav entry"
```

---

## Phase 6 — Docs, env, and manual verification

### Task 12: Env vars, privacy disclosure, and CLAUDE.md

**Files:**
- Modify: `server/.env.example` (if present; otherwise skip the file edit and just document)
- Modify: `frontend-UI/src/app/(app)/privacy/page.tsx`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add env vars to `server/.env.example`**

```
# AI Library Chat
OPENAI_API_KEY=
# Optional model overrides (defaults: gpt-4o-mini)
CHAT_MODEL_SIMPLE=
CHAT_MODEL_REASONING=
```

- [ ] **Step 2: Add an AI-disclosure paragraph to the privacy page**

In `frontend-UI/src/app/(app)/privacy/page.tsx`, add a section stating that Library Chat sends the text of user questions and derived library summaries (track titles, artists, genres, counts) to OpenAI to generate answers, that OAuth tokens are never shared with OpenAI, and that chat history is not persisted server-side. Match the existing heading/paragraph component style on that page.

- [ ] **Step 3: Update CLAUDE.md**

Add a row group under "API Endpoints" for `POST /api/chat`, `POST /api/library/sync`, `GET /api/library/snapshot`, and a "Library Chat" entry under Key Features describing the index + tool-calling architecture. Add the new env vars to the Server env table. Add `MessageSquare`/`/library-chat` to the route list.

- [ ] **Step 4: Commit**

```bash
git add server/.env.example "frontend-UI/src/app/(app)/privacy/page.tsx" CLAUDE.md
git commit -m "docs(chat): document chat env vars, privacy disclosure, endpoints"
```

---

### Task 13: End-to-end manual verification

**Prerequisite:** set `OPENAI_API_KEY` in `server/.env`.

- [ ] **Step 1: Start the app**

Run: `npm run dev`
Expected: frontend on :3000, backend on :3001.

- [ ] **Step 2: Build the index**

Log in, navigate to `/library-chat`, click "Refresh library". Poll `GET /api/library/snapshot` (or watch the status line) until `status: "fresh"`.
Expected: `likeCount` and `playlistCount` reflect your account.

- [ ] **Step 3: Ask the three canonical questions**

In the chat box, ask each:
1. "How many liked tracks by &lt;an artist you follow&gt;?"
2. "List my Tech House likes."
3. "Which of my playlists overlap the most?"

Expected: tokens stream in; a "Running &lt;tool&gt;…" status appears; final answers cite counts from tool results and disclose genre-coverage caveats where relevant.

- [ ] **Step 4: Verify no token leakage**

Open browser dev tools → Network → the `/api/chat` SSE response. Confirm no `access_token`/`refresh` values appear anywhere in the stream.
Expected: only `token`/`tool_status`/`tool_result`/`done` events with library data.

- [ ] **Step 5: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "test(chat): manual verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** index models (T1), genre normalization (T2), sync job + triggers (T5, T9), `search_likes`/`count_likes`/`find_top_overlapping_playlists` tools (T6), provider abstraction (T7), `chatRateLimiter` + per-turn caps (T8, T9), SSE streaming + tool-status UI (T9–T11), refresh control + freshness display (T11), privacy disclosure + env vars (T12). The remaining spec tools (`get_me_stats`, `compare_playlists`, `library_audit_summary`, `resolve_url`, deep-link result cards) are noted as Task 6b/follow-on extensions on the working loop — flagged explicitly rather than left implicit.
- **Deferred for honesty:** result cards with deep-links into existing tools are described in the spec UI section but the v1 page renders text answers + tool-status; deep-linking is a fast follow once answer shape is validated. Confirm with the user whether this belongs in v1 before implementation.
- **Type consistency:** `dispatchTool(name, args, ctx)`, `searchLikes(userId, opts, deps)`, `syncLibrary(userId, token, refresh, deps)`, `formatSseEvent(event, data)`, and SSE event names (`token`/`tool_status`/`tool_result`/`done`/`error`) are used identically across backend and the frontend hook.
