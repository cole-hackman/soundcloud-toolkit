/**
 * Persistent (Postgres-backed) tier of the library cache.
 *
 * The tiering is: request-cache (in-memory, seconds) -> this (minutes/hours)
 * -> SoundCloud. The in-memory tier absorbs repeat hits inside one page
 * session; this one is what survives a deploy, which is the difference
 * between "the app is fast" and "the app is fast until you ship".
 *
 * Everything here fails soft. A snapshot is an optimisation: if the tables are
 * missing or the database is unreachable, reads return null and writes are
 * dropped, and callers fall back to crawling SoundCloud exactly as before.
 */
import prisma from './prisma.js';
import logger from './logger.js';

/** Items per stored page. Matches the SoundCloud page size the client crawls
 *  at, so a crawl writes one row per upstream response. */
export const SNAPSHOT_PAGE_SIZE = 200;

export const SNAPSHOT_RESOURCES = Object.freeze([
  'likes', 'playlists', 'followings', 'followers', 'reposts',
]);

/** How long a completed snapshot is served before it is considered stale.
 *  Stale still serves — it just triggers a background refresh behind it. */
export const SNAPSHOT_TTL_MS = {
  likes: 15 * 60 * 1000,
  playlists: 15 * 60 * 1000,
  followings: 30 * 60 * 1000,
  followers: 30 * 60 * 1000,
  reposts: 15 * 60 * 1000,
};

function assertResource(resource) {
  if (!SNAPSHOT_RESOURCES.includes(resource)) {
    throw new Error(`Unknown snapshot resource: ${resource}`);
  }
}

/** Snapshot work must never fail a request. */
function softFail(operation, error) {
  logger.warn(`[snapshot-cache] ${operation} failed; falling through to SoundCloud`, {
    error: error?.message,
  });
  return null;
}

export async function readState(userId, resource) {
  assertResource(resource);
  try {
    return await prisma.libraryCacheState.findUnique({
      where: { userId_resource: { userId, resource } },
    });
  } catch (error) {
    return softFail('readState', error);
  }
}

export async function markSyncState(userId, resource, patch) {
  assertResource(resource);
  try {
    return await prisma.libraryCacheState.upsert({
      where: { userId_resource: { userId, resource } },
      create: { userId, resource, ...patch },
      update: patch,
    });
  } catch (error) {
    return softFail('markSyncState', error);
  }
}

export async function writeSnapshotPage(userId, resource, pageIndex, items) {
  assertResource(resource);
  const list = Array.isArray(items) ? items : [];
  try {
    return await prisma.libraryCachePage.upsert({
      where: { userId_resource_pageIndex: { userId, resource, pageIndex } },
      create: { userId, resource, pageIndex, items: list, itemCount: list.length },
      update: { items: list, itemCount: list.length, createdAt: new Date() },
    });
  } catch (error) {
    return softFail('writeSnapshotPage', error);
  }
}

export async function readSnapshotPage(userId, resource, pageIndex) {
  assertResource(resource);
  try {
    const row = await prisma.libraryCachePage.findUnique({
      where: { userId_resource_pageIndex: { userId, resource, pageIndex } },
    });
    return row ? { items: row.items, itemCount: row.itemCount } : null;
  } catch (error) {
    return softFail('readSnapshotPage', error);
  }
}

/**
 * Read a whole snapshot.
 *
 * Returns null when there is nothing usable — no state row, no pages, or a
 * snapshot that has never completed (a half-written crawl must not be served
 * as if it were the user's whole library).
 *
 * @returns {Promise<null | {
 *   items: unknown[], complete: boolean, stale: boolean, truncated: boolean,
 *   syncedAt: Date|null, totalItems: number
 * }>}
 */
export async function readSnapshot(userId, resource, { maxAgeMs } = {}) {
  assertResource(resource);
  const ttl = maxAgeMs ?? SNAPSHOT_TTL_MS[resource] ?? 15 * 60 * 1000;

  try {
    const state = await prisma.libraryCacheState.findUnique({
      where: { userId_resource: { userId, resource } },
    });
    if (!state || state.status !== 'complete' || !state.syncedAt) return null;

    const pages = await prisma.libraryCachePage.findMany({
      where: { userId, resource },
      orderBy: { pageIndex: 'asc' },
    });
    if (pages.length === 0) return null;

    const items = [];
    for (const page of pages) {
      if (Array.isArray(page.items)) items.push(...page.items);
    }

    return {
      items,
      complete: true,
      stale: Date.now() - state.syncedAt.getTime() > ttl,
      truncated: state.truncated === true,
      syncedAt: state.syncedAt,
      totalItems: state.totalItems ?? items.length,
    };
  } catch (error) {
    return softFail('readSnapshot', error);
  }
}

/**
 * Replace a snapshot with a freshly crawled collection.
 *
 * Written as delete-then-insert inside one transaction so a shrinking
 * collection cannot leave orphaned tail pages behind — upserting page by page
 * would keep page 9 of a crawl that now only has 4 pages.
 */
export async function writeSnapshot(userId, resource, items, { truncated = false } = {}) {
  assertResource(resource);
  const list = Array.isArray(items) ? items : [];

  const pages = [];
  for (let i = 0; i < list.length; i += SNAPSHOT_PAGE_SIZE) {
    pages.push(list.slice(i, i + SNAPSHOT_PAGE_SIZE));
  }

  try {
    await prisma.$transaction([
      prisma.libraryCachePage.deleteMany({ where: { userId, resource } }),
      ...pages.map((pageItems, pageIndex) => prisma.libraryCachePage.create({
        data: { userId, resource, pageIndex, items: pageItems, itemCount: pageItems.length },
      })),
      prisma.libraryCacheState.upsert({
        where: { userId_resource: { userId, resource } },
        create: {
          userId, resource, status: 'complete', totalItems: list.length,
          pagesSynced: pages.length, truncated, syncedAt: new Date(), error: null,
        },
        update: {
          status: 'complete', totalItems: list.length,
          pagesSynced: pages.length, truncated, syncedAt: new Date(), error: null,
        },
      }),
    ]);
    return { pages: pages.length, items: list.length };
  } catch (error) {
    return softFail('writeSnapshot', error);
  }
}

/**
 * Mark snapshots stale WITHOUT deleting them.
 *
 * A stale snapshot still serves instantly while a refresh runs behind it,
 * which is strictly better than dropping the user back to a cold crawl. The
 * exception is a mutation the user just made: those call this and then rely on
 * the in-memory tier having been invalidated too, so the next read revalidates.
 */
export async function invalidateSnapshot(userId, resources) {
  const list = (Array.isArray(resources) ? resources : [resources])
    .filter((r) => SNAPSHOT_RESOURCES.includes(r));
  if (list.length === 0) return null;
  try {
    return await prisma.libraryCacheState.updateMany({
      where: { userId, resource: { in: list } },
      data: { status: 'stale' },
    });
  } catch (error) {
    return softFail('invalidateSnapshot', error);
  }
}

/** Drop a user's snapshots outright. Used on account deletion as a belt-and-
 *  braces companion to the ON DELETE CASCADE. */
export async function dropSnapshots(userId) {
  try {
    await prisma.$transaction([
      prisma.libraryCachePage.deleteMany({ where: { userId } }),
      prisma.libraryCacheState.deleteMany({ where: { userId } }),
    ]);
  } catch (error) {
    softFail('dropSnapshots', error);
  }
}
