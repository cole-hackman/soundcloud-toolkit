import express from 'express';
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
 * GET /api/admin/feedback/summary?period=30d&campaignId=<id>
 *
 * Aggregate counts for the SongSwipe beta survey: interest, Rekordbox use,
 * platform, and beta opt-in count.
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
