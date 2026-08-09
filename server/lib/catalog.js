import { Prisma } from '@prisma/client';
import prisma from './prisma.js';
import logger from './logger.js';

// Harvest-at-source for the music catalog (tracks/playlists tables).
// Callers pass whatever full objects they already fetched from SoundCloud —
// raw API track objects or normalizeResource() output — and this module
// upserts them fire-and-forget at zero additional SoundCloud API cost.

const UPSERT_CHUNK = 100;

export function normalizeGenre(genre) {
  if (typeof genre !== 'string') return null;
  const g = genre.trim().toLowerCase();
  return g.length > 0 ? g : null;
}

/**
 * Map a track object to a catalog row. Accepts raw SoundCloud API shapes
 * (duration, user.username) and normalizeResource() shapes (duration_ms).
 * Returns null when there is no usable numeric ID.
 */
export function mapTrackForCatalog(t) {
  if (!t || typeof t !== 'object') return null;
  const id = Number(t.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const title = typeof t.title === 'string' && t.title.trim() ? t.title.trim() : null;
  const artistName = t.user?.username ?? t.username ?? null;
  const artistId = Number(t.user?.id) || null;
  const genre = typeof t.genre === 'string' && t.genre.trim() ? t.genre.trim() : null;
  const durationMs = Number(t.duration ?? t.duration_ms) || null;
  const access = typeof t.access === 'string' ? t.access : null;
  const permalinkUrl = typeof t.permalink_url === 'string' ? t.permalink_url : null;
  return { id, title, artistName, artistId, genre, genreNormalized: normalizeGenre(genre), durationMs, access, permalinkUrl };
}

/** Map a playlist object to a catalog row; null when there's no numeric ID. */
export function mapPlaylistForCatalog(p) {
  if (!p || typeof p !== 'object') return null;
  const id = Number(p.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const title = typeof p.title === 'string' && p.title.trim() ? p.title.trim() : null;
  const ownerScId = Number(p.user?.id) || null;
  const trackCount = Number(p.track_count) || (Array.isArray(p.tracks) ? p.tracks.length : null);
  return { id, title, ownerScId, trackCount };
}

/** Dedupe rows by id — a multi-row ON CONFLICT upsert cannot touch a row twice. */
function dedupeById(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!row) continue;
    // Later rows win so fresher fields (e.g. access) overwrite within a batch
    byId.set(row.id, byId.has(row.id) ? { ...byId.get(row.id), ...row } : row);
  }
  return [...byId.values()];
}

/**
 * Awaitable upsert of mapped track rows. New fields overwrite; missing fields
 * never blank out existing data (COALESCE). A row that arrives with a title is
 * 'resolved' — including previously-'gone' rows that reappear upstream.
 */
export async function upsertTrackRows(rows) {
  const clean = dedupeById(rows);
  for (let i = 0; i < clean.length; i += UPSERT_CHUNK) {
    const chunk = clean.slice(i, i + UPSERT_CHUNK);
    const values = chunk.map(r => Prisma.sql`(
      ${r.id}, ${r.title}, ${r.artistName}, ${r.artistId}, ${r.genre},
      ${r.genreNormalized}, ${r.durationMs}, ${r.access}, ${r.permalinkUrl},
      ${r.title != null ? 'resolved' : 'pending'}
    )`);
    await prisma.$executeRaw`
      INSERT INTO "tracks"
        ("id", "title", "artistName", "artistId", "genre", "genreNormalized",
         "durationMs", "access", "permalinkUrl", "resolveStatus")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("id") DO UPDATE SET
        "title" = COALESCE(EXCLUDED."title", "tracks"."title"),
        "artistName" = COALESCE(EXCLUDED."artistName", "tracks"."artistName"),
        "artistId" = COALESCE(EXCLUDED."artistId", "tracks"."artistId"),
        "genre" = COALESCE(EXCLUDED."genre", "tracks"."genre"),
        "genreNormalized" = COALESCE(EXCLUDED."genreNormalized", "tracks"."genreNormalized"),
        "durationMs" = COALESCE(EXCLUDED."durationMs", "tracks"."durationMs"),
        "access" = COALESCE(EXCLUDED."access", "tracks"."access"),
        "permalinkUrl" = COALESCE(EXCLUDED."permalinkUrl", "tracks"."permalinkUrl"),
        "resolveStatus" = CASE
          WHEN EXCLUDED."title" IS NOT NULL THEN 'resolved'
          ELSE "tracks"."resolveStatus"
        END,
        "lastSeenAt" = CURRENT_TIMESTAMP
    `;
  }
  return clean.length;
}

/** Awaitable upsert of mapped playlist rows. */
export async function upsertPlaylistRows(rows) {
  const clean = dedupeById(rows);
  for (let i = 0; i < clean.length; i += UPSERT_CHUNK) {
    const chunk = clean.slice(i, i + UPSERT_CHUNK);
    const values = chunk.map(r => Prisma.sql`(${r.id}, ${r.title}, ${r.ownerScId}, ${r.trackCount})`);
    await prisma.$executeRaw`
      INSERT INTO "playlists" ("id", "title", "ownerScId", "trackCount")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("id") DO UPDATE SET
        "title" = COALESCE(EXCLUDED."title", "playlists"."title"),
        "ownerScId" = COALESCE(EXCLUDED."ownerScId", "playlists"."ownerScId"),
        "trackCount" = COALESCE(EXCLUDED."trackCount", "playlists"."trackCount"),
        "lastSeenAt" = CURRENT_TIMESTAMP
    `;
  }
  return clean.length;
}

/**
 * Fire-and-forget track harvest. Call WITHOUT await from request handlers —
 * never throws, never blocks a response.
 */
export function harvestTracks(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return;
  const rows = tracks.map(mapTrackForCatalog).filter(Boolean);
  if (rows.length === 0) return;
  upsertTrackRows(rows).catch(err => {
    logger.error('[catalog] Track harvest failed:', err.message);
  });
}

/** Fire-and-forget playlist harvest. */
export function harvestPlaylists(playlists) {
  if (!Array.isArray(playlists) || playlists.length === 0) return;
  const rows = playlists.map(mapPlaylistForCatalog).filter(Boolean);
  if (rows.length === 0) return;
  upsertPlaylistRows(rows).catch(err => {
    logger.error('[catalog] Playlist harvest failed:', err.message);
  });
}
