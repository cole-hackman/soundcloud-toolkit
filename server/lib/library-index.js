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
