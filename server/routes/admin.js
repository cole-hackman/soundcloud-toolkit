import express from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { safeError } from '../lib/safe-error.js';
import { authenticateUser } from '../middleware/auth.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getAnalyticsWriteHealth } from '../lib/analytics.js';

const router = express.Router();

const ACTION_NAMES = {
  'merge': 'Playlist Merge',
  'from-likes': 'Likes → Playlist',
  'playlist-transfer': 'Playlist track move/duplicate',
  'bulk-unlike': 'Bulk Unlike',
  'bulk-like': 'Bulk Like (Playlist → Likes)',
  'bulk-unfollow': 'Bulk Unfollow',
  'resolve': 'URL Resolve',
  'batch-resolve': 'Batch Resolve',
  'proxy-download': 'Proxy Download',
  'bulk-remove-reposts': 'Remove Reposts',
  'library-audit': 'Library Audit',
  'playlist-compare': 'Playlist Compare',
  'clone': 'Playlist Clone',
  'delete-playlist': 'Delete Playlist',
  'genre-search': 'Genre Search',
  'growth-discover': 'Growth: Discover',
  'growth-engage-start': 'Growth: Engage',
  'growth-reverse': 'Growth: Reverse',
  'growth-check-followbacks': 'Growth: Check follow-backs',
  'auth-login': 'Login',
  'auth-logout': 'Logout',
  'followed-likes-to-playlist': "Followed User's Likes → Playlist",
  'followed-playlist-clone': "Followed User's Playlist Clone",
};

const ACTION_COLORS = {
  'merge': '#FF5500',
  'from-likes': '#2ECC71',
  'playlist-transfer': '#9B59B6',
  'bulk-unlike': '#00D4AA',
  'bulk-like': '#1ABC9C',
  'bulk-unfollow': '#E066FF',
  'resolve': '#F1C40F',
  'batch-resolve': '#F19A0F',
  'proxy-download': '#4DA6FF',
  'bulk-remove-reposts': '#E74C3C',
  'library-audit': '#16A34A',
  'playlist-compare': '#7C3AED',
  'clone': '#2563EB',
  'delete-playlist': '#DC2626',
  'genre-search': '#0EA5E9',
  'growth-discover': '#A855F7',
  'growth-engage-start': '#A855F7',
  'growth-reverse': '#A855F7',
  'growth-check-followbacks': '#A855F7',
  'auth-login': '#64748B',
  'auth-logout': '#64748B',
  'followed-likes-to-playlist': '#0D9488',
  'followed-playlist-clone': '#0D9488',
};

const FEATURE_NAMES = {
  dashboard: 'Dashboard',
  downloads: 'Downloads',
  export: 'Export',
  'library-audit': 'Library Audit',
  combine: 'Combine Playlists',
  modifier: 'Playlist Modifier',
  'playlist-cloner': 'Playlist Cloner',
  'playlist-compare': 'Playlist Compare',
  'health-check': 'Playlist Health Check',
  likes: 'Likes to Playlist',
  'like-manager': 'Like Manager',
  'following-manager': 'Following Manager',
  'following-library': 'Following Library',
  'repost-manager': 'Repost Manager',
  activity: 'Activity to Playlist',
  growth: 'Grow Your Network',
  'genre-search': 'Genre Search',
  resolver: 'Link Resolver',
  'batch-resolver': 'Batch Link Resolver',
  'recently-played': 'Recently Played',
};

function periodToCutoff(period) {
  if (period === 'all') {
    return new Date(0);
  }

  if (period === 'month') {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function validPeriod(p) {
  return ['1d', '7d', '30d', '90d', 'month', 'all'].includes(p) ? p : '30d';
}

/**
 * GET /api/admin/stats?period=1d|7d|30d|90d|month|all
 *
 * Returns aggregated stats for the dashboard top cards, feature usage,
 * sidebar quick stats, and health/rate metrics.
 */
router.get('/stats', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);

    // Page-open signals (`view:*`) are intentionally excluded from operation
    // metrics. They are reported separately below as feature reach.
    const operationWhere = {
      createdAt: { gte: cutoff },
      action: { not: { startsWith: 'view:' } },
    };

    const [
      totalUsers,
      newUsers,
      agg,
      byAction,
      byActionErrors,
      byStatus,
      splitsCount,
      activeUsersPeriodRows,
      featureReachRows,
      topErrors,
      avgLatencyRows,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: cutoff } } }),
      prisma.operationLog.aggregate({
        where: operationWhere,
        _sum: { trackCount: true },
        _count: { id: true },
        _avg: { trackCount: true, durationMs: true },
      }),
      prisma.operationLog.groupBy({
        by: ['action'],
        where: operationWhere,
        _count: { id: true },
        _avg: { durationMs: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.operationLog.groupBy({
        by: ['action'],
        where: { ...operationWhere, status: 'error' },
        _count: { id: true },
      }),
      prisma.operationLog.groupBy({
        by: ['status'],
        where: operationWhere,
        _count: { id: true },
      }),
      prisma.operationLog.count({
        where: { ...operationWhere, status: 'split' },
      }),
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "userId")::int AS count
        FROM operation_logs
        WHERE "createdAt" >= ${cutoff} AND action NOT LIKE 'view:%'
      `,
      prisma.$queryRaw`
        SELECT
          action,
          COUNT(DISTINCT "userId")::int AS users,
          COUNT(*)::int AS opens
        FROM operation_logs
        WHERE "createdAt" >= ${cutoff} AND action LIKE 'view:%'
        GROUP BY action
        ORDER BY users DESC, opens DESC, action ASC
      `,
      prisma.operationLog.groupBy({
        by: ['errorCode'],
        where: { ...operationWhere, status: 'error' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      prisma.$queryRaw`
        SELECT
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::int AS p95,
          AVG("durationMs")::int AS avg
        FROM operation_logs
        WHERE "createdAt" >= ${cutoff} AND action NOT LIKE 'view:%' AND "durationMs" IS NOT NULL
      `,
    ]);

    const operationsCount = agg._count.id ?? 0;
    const tracksProcessed = agg._sum.trackCount ?? 0;
    const avgTracksPerOp = agg._avg.trackCount ? Math.round(agg._avg.trackCount) : 0;
    const avgDurationMs = agg._avg.durationMs ? Math.round(agg._avg.durationMs) : 0;
    const p95DurationMs = Number(avgLatencyRows?.[0]?.p95 ?? 0);
    const activeUsersPeriod = Number(activeUsersPeriodRows?.[0]?.count ?? 0);

    const errorCountByAction = {};
    for (const row of byActionErrors) errorCountByAction[row.action] = row._count.id;

    const featureUsage = byAction.map(row => ({
      key: row.action,
      name: ACTION_NAMES[row.action] || row.action,
      count: row._count.id,
      avgDurationMs: row._avg.durationMs ? Math.round(row._avg.durationMs) : 0,
      errorCount: errorCountByAction[row.action] ?? 0,
      errorRate: row._count.id > 0 ? Math.round(((errorCountByAction[row.action] ?? 0) / row._count.id) * 100) : 0,
      color: ACTION_COLORS[row.action] || '#888888',
    }));

    const errorRateByAction = featureUsage
      .filter(f => f.errorCount > 0)
      .sort((a, b) => b.errorRate - a.errorRate || b.errorCount - a.errorCount)
      .slice(0, 8);

    // null errorCode buckets are real errors from paths that predate (or still
    // lack) error capture — label them rather than filtering them out.
    const errorBreakdown = topErrors.map(e => ({
      errorCode: e.errorCode ?? 'UNSPECIFIED',
      count: e._count.id,
    }));

    const topFeature = featureUsage.length > 0 ? featureUsage[0] : null;
    const featureReach = featureReachRows.map(row => {
      const slug = row.action.slice('view:'.length);
      return {
        key: slug,
        name: FEATURE_NAMES[slug] || slug,
        users: Number(row.users),
        opens: Number(row.opens),
      };
    });

    const statusMap = {};
    for (const row of byStatus) statusMap[row.status] = row._count.id;
    const total = operationsCount || 1;
    // Auto-splits are successful outcomes (the output just exceeded SoundCloud's
    // 500-track cap), so they count toward the headline success rate.
    const successRate = Math.round((((statusMap['success'] ?? 0) + (statusMap['split'] ?? 0)) / total) * 100);
    const splitRate = Math.round(((statusMap['split'] ?? 0) / total) * 100);
    const errorRate = Math.round(((statusMap['error'] ?? 0) / total) * 100);
    const partialRate = Math.round(((statusMap['partial'] ?? 0) / total) * 100);

    res.json({
      totalUsers,
      newUsers,
      tracksProcessed,
      operationsCount,
      featureUsage,
      featureReach,
      errorBreakdown,
      errorRateByAction,
      splitsCount,
      avgTracksPerOp,
      avgDurationMs,
      p95DurationMs,
      successRate,
      splitRate,
      errorRate,
      partialRate,
      partialCount: statusMap['partial'] ?? 0,
      topFeature,
      activeUsersPeriod,
      analyticsWriteHealth: getAnalyticsWriteHealth(),
    });
  } catch (err) {
    logger.error('[admin/stats] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/daily?period=1d|7d|30d|90d|month|all
 *
 * Returns daily time-series data for chart rendering.
 * Uses raw SQL DATE_TRUNC since Prisma groupBy doesn't support it.
 * Fills zero for days with no activity.
 */
router.get('/daily', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);

    const [opsRows, userRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(*)::int                  AS operations,
          COALESCE(SUM("trackCount"), 0)::int AS tracks
        FROM operation_logs
        WHERE "createdAt" >= ${cutoff} AND action NOT LIKE 'view:%'
        GROUP BY day
        ORDER BY day ASC
      `,
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(*)::int AS new_users
        FROM users
        WHERE "createdAt" >= ${cutoff}
        GROUP BY day
        ORDER BY day ASC
      `,
    ]);

    let days;
    if (period === '1d') days = 1;
    else if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    else if (period === 'month') {
      days = Math.max(Math.ceil((Date.now() - cutoff.getTime()) / 86_400_000), 1);
    } else if (period === 'all') {
      // Derive the day count from the earliest activity actually returned above,
      // rather than the epoch cutoff, and cap it — otherwise a long-lived account
      // would ask for a multi-decade day-by-day series. The top stat cards (which
      // hit /stats, not /daily) still aggregate over full history regardless of
      // this cap; it only bounds the trend chart's resolution.
      const earliestDates = [...opsRows, ...userRows].map(r => new Date(r.day).getTime());
      const earliest = earliestDates.length > 0 ? Math.min(...earliestDates) : Date.now();
      days = Math.min(Math.max(Math.ceil((Date.now() - earliest) / 86_400_000) + 1, 1), 365);
    } else {
      days = 30;
    }
    const result = [];

    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      d.setHours(0, 0, 0, 0);
      const dayStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const opsRow = opsRows.find(r => new Date(r.day).toISOString().slice(0, 10) === dayStr);
      const userRow = userRows.find(r => new Date(r.day).toISOString().slice(0, 10) === dayStr);

      result.push({
        date: label,
        tracks: opsRow ? Number(opsRow.tracks) : 0,
        operations: opsRow ? Number(opsRow.operations) : 0,
        newUsers: userRow ? Number(userRow.new_users) : 0,
      });
    }

    res.json({ daily: result });
  } catch (err) {
    logger.error('[admin/daily] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch daily data' });
  }
});

/**
 * GET /api/admin/operations?period=1d|7d|30d|90d|month|all&limit=20&action=<action>&status=<status>&search=<query>
 *
 * Returns recent operation logs with user info and detailed metadata.
 */
router.get('/operations', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const actionFilter = typeof req.query.action === 'string' && req.query.action.trim() ? req.query.action.trim() : null;
    const statusFilter = typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : null;
    const searchFilter = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : null;

    const where = {
      createdAt: { gte: cutoff },
      action: actionFilter ? actionFilter : { not: { startsWith: 'view:' } },
    };
    if (statusFilter && ['success', 'split', 'error', 'partial'].includes(statusFilter)) {
      where.status = statusFilter;
    }
    if (searchFilter) {
      const searchNum = Number(searchFilter);
      const isNum = !isNaN(searchNum) && searchNum > 0;
      where.OR = [
        { user: { username: { contains: searchFilter, mode: 'insensitive' } } },
        { user: { displayName: { contains: searchFilter, mode: 'insensitive' } } },
        { errorCode: { contains: searchFilter, mode: 'insensitive' } },
        { errorMessage: { contains: searchFilter, mode: 'insensitive' } },
      ];
      if (isNum) {
        where.OR.push({ soundcloudId: searchNum });
      }
    }

    const logs = await prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { username: true, displayName: true, avatarUrl: true, soundcloudId: true },
        },
      },
    });

    const operations = logs.map(log => ({
      id: log.id,
      user: {
        username: log.user.username,
        displayName: log.user.displayName,
        avatarUrl: log.user.avatarUrl,
        soundcloudId: log.user.soundcloudId,
      },
      soundcloudId: log.soundcloudId || log.user?.soundcloudId,
      action: log.action,
      actionName: ACTION_NAMES[log.action] || log.action,
      trackCount: log.trackCount,
      itemCount: log.itemCount,
      status: log.status,
      durationMs: log.durationMs,
      errorCode: log.errorCode,
      errorMessage: log.errorMessage,
      clientInfo: log.clientInfo,
      createdAt: log.createdAt.toISOString(),
      metadata: log.metadata,
    }));

    res.json({ operations });
  } catch (err) {
    logger.error('[admin/operations] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch operations' });
  }
});

/**
 * GET /api/admin/catalog/summary?period=...
 *
 * Aggregate view over the music catalog: totals, genre/access/resolve
 * breakdowns (gaps included — unresolved and null-genre are first-class),
 * plus period-scoped touch volume from operation_logs ID arrays.
 */
router.get('/catalog/summary', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);

    const [totalsRows, playlistsCount, accessRows, resolveRows, genreRows, touchRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS tracks,
               COUNT(DISTINCT COALESCE("artistId"::text, "artistName"))::int AS artists
        FROM "tracks"
      `,
      prisma.playlist.count(),
      prisma.track.groupBy({ by: ['access'], _count: { id: true } }),
      prisma.track.groupBy({ by: ['resolveStatus'], _count: { id: true } }),
      prisma.$queryRaw`
        SELECT COALESCE("genreNormalized", '(none)') AS genre, COUNT(*)::int AS count
        FROM "tracks"
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 12
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS touch_events,
               COUNT(DISTINCT track_id)::int AS distinct_tracks
        FROM (
          SELECT (jsonb_array_elements_text(metadata->'trackIds'))::bigint AS track_id
          FROM operation_logs
          WHERE "createdAt" >= ${cutoff} AND metadata ? 'trackIds'
        ) touches
      `,
    ]);

    const toCounts = (rows, field) => rows.reduce((acc, row) => {
      acc[row[field] ?? 'unknown'] = row._count.id;
      return acc;
    }, {});

    res.json({
      period,
      totalTracks: totalsRows[0]?.tracks ?? 0,
      totalArtists: totalsRows[0]?.artists ?? 0,
      totalPlaylists: playlistsCount,
      accessBreakdown: toCounts(accessRows, 'access'),
      resolveBreakdown: toCounts(resolveRows, 'resolveStatus'),
      genreBreakdown: genreRows.map(g => ({ genre: g.genre, count: Number(g.count) })),
      periodTouchEvents: Number(touchRows[0]?.touch_events ?? 0),
      periodDistinctTracks: Number(touchRows[0]?.distinct_tracks ?? 0),
    });
  } catch (err) {
    logger.error('[admin/catalog/summary] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch catalog summary' });
  }
});

const CATALOG_SORTS = {
  touches: 'touches',
  users: 'users',
  lastTouched: 'last_touched',
  title: 't."title"',
  artist: 't."artistName"',
  firstSeen: 't."firstSeenAt"',
};

/**
 * GET /api/admin/catalog/tracks
 *   ?period=&genre=&artist=&access=&resolveStatus=&action=&sort=&order=&page=&pageSize=
 *
 * Paginated catalog rows with period-scoped touch counts. Aggregate by
 * default — no user identity in this listing; per-user drill-down is the
 * separate /catalog/tracks/:id/operations endpoint. With an action filter
 * the join tightens to tracks actually touched by that action in-period;
 * otherwise zero-touch rows stay visible so gaps (unresolved, null genre,
 * blocked/preview) can be explored.
 */
router.get('/catalog/tracks', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 25, 1), 100);
    // Object.hasOwn, not truthiness: '?sort=constructor' must not reach Prisma.raw
    const sortKey = Object.hasOwn(CATALOG_SORTS, req.query.sort) ? req.query.sort : 'touches';
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
    const genre = typeof req.query.genre === 'string' && req.query.genre.trim() ? req.query.genre.trim() : null;
    const artist = typeof req.query.artist === 'string' && req.query.artist.trim() ? req.query.artist.trim() : null;
    const access = typeof req.query.access === 'string' && req.query.access.trim() ? req.query.access.trim() : null;
    const resolveStatus = typeof req.query.resolveStatus === 'string' && req.query.resolveStatus.trim() ? req.query.resolveStatus.trim() : null;
    const action = typeof req.query.action === 'string' && req.query.action.trim() ? req.query.action.trim() : null;

    const touchesCte = Prisma.sql`
      SELECT (jsonb_array_elements_text(metadata->'trackIds'))::bigint AS track_id,
             COUNT(*) AS touch_count,
             COUNT(DISTINCT "userId") AS user_count,
             MAX("createdAt") AS last_touched
      FROM operation_logs
      WHERE "createdAt" >= ${cutoff} AND metadata ? 'trackIds'
        ${action ? Prisma.sql`AND action = ${action}` : Prisma.empty}
      GROUP BY 1
    `;

    const filters = [];
    if (genre) {
      filters.push(genre === '(none)'
        ? Prisma.sql`t."genreNormalized" IS NULL`
        : Prisma.sql`t."genreNormalized" = ${genre}`);
    }
    if (artist) filters.push(Prisma.sql`t."artistName" ILIKE ${'%' + artist + '%'}`);
    if (access) {
      filters.push(access === 'unknown'
        ? Prisma.sql`t."access" IS NULL`
        : Prisma.sql`t."access" = ${access}`);
    }
    if (resolveStatus) filters.push(Prisma.sql`t."resolveStatus" = ${resolveStatus}`);
    const whereSql = filters.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
      : Prisma.empty;

    // Action filter means "touched by this action" — inner join; otherwise
    // keep zero-touch catalog rows visible.
    const joinSql = action
      ? Prisma.sql`INNER JOIN touches tc ON tc.track_id = t.id`
      : Prisma.sql`LEFT JOIN touches tc ON tc.track_id = t.id`;

    const orderSql = Prisma.raw(`${CATALOG_SORTS[sortKey]} ${order} NULLS LAST, t.id ASC`);

    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw`
        WITH touches AS (${touchesCte})
        SELECT t.id, t.title, t."artistName", t."artistId", t.genre, t."genreNormalized",
               t."durationMs", t.access, t."permalinkUrl", t."resolveStatus",
               t."resolveAttempts", t."firstSeenAt", t."lastSeenAt",
               COALESCE(tc.touch_count, 0)::int AS touches,
               COALESCE(tc.user_count, 0)::int AS users,
               tc.last_touched
        FROM "tracks" t
        ${joinSql}
        ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      prisma.$queryRaw`
        WITH touches AS (${touchesCte})
        SELECT COUNT(*)::int AS total
        FROM "tracks" t
        ${joinSql}
        ${whereSql}
      `,
    ]);

    res.json({
      tracks: rows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
      sort: sortKey,
      order: order.toLowerCase(),
    });
  } catch (err) {
    logger.error('[admin/catalog/tracks] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch catalog tracks' });
  }
});

/**
 * GET /api/admin/catalog/tracks/:id/operations
 *
 * Deliberate per-user drill-down for one track: the operations that touched
 * it, with user identity. Served separately from the aggregate listing.
 */
router.get('/catalog/tracks/:id/operations', authenticateUser, adminAuth, async (req, res) => {
  try {
    const trackId = Number(req.params.id);
    if (!Number.isInteger(trackId) || trackId <= 0) {
      return res.status(400).json({ error: 'Invalid track id' });
    }
    const rows = await prisma.$queryRaw`
      SELECT ol.id, ol.action, ol.status, ol."createdAt",
             u.username, u."displayName", u."soundcloudId"
      FROM operation_logs ol
      JOIN users u ON u.id = ol."userId"
      WHERE ol.metadata @> jsonb_build_object('trackIds', jsonb_build_array(${trackId}::bigint))
      ORDER BY ol."createdAt" DESC
      LIMIT 50
    `;
    res.json({
      operations: rows.map(r => ({
        id: r.id,
        action: r.action,
        actionName: ACTION_NAMES[r.action] || r.action,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        user: { username: r.username, displayName: r.displayName, soundcloudId: Number(r.soundcloudId) },
      })),
    });
  } catch (err) {
    logger.error('[admin/catalog/track-operations] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch track operations' });
  }
});

/**
 * GET /api/admin/rebrand/summary?period=30d&campaignId=<id>
 *
 * Live survey: vote tally for the rename shortlist, plus how many people
 * left a name of their own or a feature request.
 */
router.get('/rebrand/summary', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const campaignId = typeof req.query.campaignId === 'string' && req.query.campaignId.trim()
      ? req.query.campaignId.trim()
      : null;

    const where = { createdAt: { gte: cutoff } };
    if (campaignId) where.campaignId = campaignId;

    const [total, byChoice, withNameIdea, withFeatureIdea] = await Promise.all([
      prisma.rebrandVote.count({ where }),
      prisma.rebrandVote.groupBy({ by: ['nameChoice'], where, _count: { id: true } }),
      prisma.rebrandVote.count({ where: { ...where, nameIdea: { not: null } } }),
      prisma.rebrandVote.count({ where: { ...where, featureIdea: { not: null } } }),
    ]);

    const nameChoice = byChoice.reduce((acc, row) => {
      acc[row.nameChoice ?? 'unanswered'] = row._count.id;
      return acc;
    }, {});

    res.json({
      period,
      campaignId,
      total,
      nameChoice,
      nameIdeaCount: withNameIdea,
      featureIdeaCount: withFeatureIdea,
    });
  } catch (err) {
    logger.error('[admin/rebrand/summary] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch rebrand summary' });
  }
});

/**
 * GET /api/admin/rebrand?period=30d&limit=50&campaignId=<id>
 * Individual votes, newest first — this is where the write-in names and
 * feature requests are read.
 */
router.get('/rebrand', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const campaignId = typeof req.query.campaignId === 'string' && req.query.campaignId.trim()
      ? req.query.campaignId.trim()
      : null;

    const where = { createdAt: { gte: cutoff } };
    if (campaignId) where.campaignId = campaignId;

    const rows = await prisma.rebrandVote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    });

    res.json({
      responses: rows.map(r => ({
        id: r.id,
        user: {
          username: r.user.username,
          displayName: r.user.displayName,
          avatarUrl: r.user.avatarUrl,
        },
        soundcloudId: r.soundcloudId,
        campaignId: r.campaignId,
        nameChoice: r.nameChoice,
        nameIdea: r.nameIdea,
        featureIdea: r.featureIdea,
        context: r.context,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error('[admin/rebrand] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch rebrand votes' });
  }
});

/**
 * GET /api/admin/feedback/summary?period=30d&campaignId=<id>
 *
 * RETIRED survey — kept read-only for history. Aggregate counts for the
 * SongSwipe beta survey: interest, Rekordbox use, platform, beta opt-in count.
 */
router.get('/feedback/summary', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const campaignId = typeof req.query.campaignId === 'string' && req.query.campaignId.trim()
      ? req.query.campaignId.trim()
      : null;

    const where = { createdAt: { gte: cutoff } };
    if (campaignId) where.campaignId = campaignId;

    const [total, byInterest, byRekordbox, byPlatform, wantsBeta] = await Promise.all([
      prisma.betaSignup.count({ where }),
      prisma.betaSignup.groupBy({ by: ['interest'], where, _count: { id: true } }),
      prisma.betaSignup.groupBy({ by: ['rekordboxUse'], where, _count: { id: true } }),
      prisma.betaSignup.groupBy({ by: ['platform'], where, _count: { id: true } }),
      prisma.betaSignup.count({ where: { ...where, wantsBeta: true } }),
    ]);

    const toCounts = (rows, field) => rows.reduce((acc, row) => {
      acc[row[field] ?? 'unanswered'] = row._count.id;
      return acc;
    }, {});

    res.json({
      period,
      campaignId,
      total,
      wantsBetaCount: wantsBeta,
      interest: toCounts(byInterest, 'interest'),
      rekordboxUse: toCounts(byRekordbox, 'rekordboxUse'),
      platform: toCounts(byPlatform, 'platform'),
    });
  } catch (err) {
    logger.error('[admin/feedback/summary] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch feedback summary' });
  }
});

/**
 * GET /api/admin/feedback?period=30d&limit=50&campaignId=<id>
 */
router.get('/feedback', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const campaignId = typeof req.query.campaignId === 'string' && req.query.campaignId.trim()
      ? req.query.campaignId.trim()
      : null;

    const where = { createdAt: { gte: cutoff } };
    if (campaignId) where.campaignId = campaignId;

    const rows = await prisma.betaSignup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    });

    const responses = rows.map(r => ({
      id: r.id,
      user: {
        username: r.user.username,
        displayName: r.user.displayName,
        avatarUrl: r.user.avatarUrl,
      },
      soundcloudId: r.soundcloudId,
      campaignId: r.campaignId,
      email: r.email,
      rekordboxUse: r.rekordboxUse,
      platform: r.platform,
      cullMethod: r.cullMethod,
      featuresWanted: r.featuresWanted,
      editHesitations: r.editHesitations,
      trustDirectWrite: r.trustDirectWrite,
      interest: r.interest,
      wantsBeta: r.wantsBeta,
      wantsCall: r.wantsCall,
      suggestions: r.suggestions,
      nameIdea: r.nameIdea,
      context: r.context,
      createdAt: r.createdAt.toISOString(),
    }));

    res.json({ responses });
  } catch (err) {
    logger.error('[admin/feedback] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to fetch feedback responses' });
  }
});

/**
 * GET /api/admin/feedback/beta-emails?period=30d&campaignId=<id>
 * CSV export of beta opt-ins — the invite list.
 */
router.get('/feedback/beta-emails', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const campaignId = typeof req.query.campaignId === 'string' && req.query.campaignId.trim()
      ? req.query.campaignId.trim()
      : null;

    const where = { wantsBeta: true, email: { not: null }, createdAt: { gte: cutoff } };
    if (campaignId) where.campaignId = campaignId;

    const rows = await prisma.betaSignup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        email: true,
        platform: true,
        interest: true,
        wantsCall: true,
        rekordboxUse: true,
        createdAt: true,
      },
    });

    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['email', 'platform', 'interest', 'wantsCall', 'rekordboxUse', 'createdAt'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        r.email, r.platform, r.interest, r.wantsCall, r.rekordboxUse, r.createdAt.toISOString(),
      ].map(escape).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="beta-emails.csv"');
    res.send(`﻿${lines.join('\n')}`);
  } catch (err) {
    logger.error('[admin/feedback/beta-emails] Error:', safeError(err));
    res.status(500).json({ error: 'Failed to export beta emails' });
  }
});

export default router;
