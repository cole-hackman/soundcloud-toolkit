import express from 'express';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';
import { authenticateUser } from '../middleware/auth.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

const ACTION_NAMES = {
  'merge': 'Playlist Merge',
  'from-likes': 'Likes → Playlist',
  'playlist-transfer': 'Playlist track move/duplicate',
  'bulk-unlike': 'Bulk Unlike',
  'bulk-unfollow': 'Bulk Unfollow',
  'resolve': 'URL Resolve',
  'batch-resolve': 'Batch Resolve',
  'proxy-download': 'Proxy Download',
  'bulk-remove-reposts': 'Remove Reposts',
};

const ACTION_COLORS = {
  'merge': '#FF5500',
  'from-likes': '#2ECC71',
  'playlist-transfer': '#9B59B6',
  'bulk-unlike': '#00D4AA',
  'bulk-unfollow': '#E066FF',
  'resolve': '#F1C40F',
  'batch-resolve': '#F19A0F',
  'proxy-download': '#4DA6FF',
  'bulk-remove-reposts': '#E74C3C',
};

function periodToCutoff(period) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 28;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function validPeriod(p) {
  return ['7d', '28d', '90d'].includes(p) ? p : '28d';
}

/**
 * GET /api/admin/stats?period=7d|28d|90d
 *
 * Returns aggregated stats for the dashboard top cards, feature usage,
 * sidebar quick stats, and health/rate metrics.
 */
router.get('/stats', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);

    const [totalUsers, newUsers, agg, byAction, byStatus, splitsCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: cutoff } } }),
      prisma.operationLog.aggregate({
        where: { createdAt: { gte: cutoff } },
        _sum: { trackCount: true },
        _count: { id: true },
        _avg: { trackCount: true },
      }),
      prisma.operationLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: cutoff } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.operationLog.groupBy({
        by: ['status'],
        where: { createdAt: { gte: cutoff } },
        _count: { id: true },
      }),
      prisma.operationLog.count({
        where: { createdAt: { gte: cutoff }, status: 'split' },
      }),
    ]);

    const operationsCount = agg._count.id ?? 0;
    const tracksProcessed = agg._sum.trackCount ?? 0;
    const avgTracksPerOp = agg._avg.trackCount ? Math.round(agg._avg.trackCount) : 0;

    const featureUsage = byAction.map(row => ({
      key: row.action,
      name: ACTION_NAMES[row.action] || row.action,
      count: row._count.id,
      color: ACTION_COLORS[row.action] || '#888888',
    }));

    const topFeature = featureUsage.length > 0 ? featureUsage[0] : null;

    const statusMap = {};
    for (const row of byStatus) statusMap[row.status] = row._count.id;
    const total = operationsCount || 1;
    const successRate = Math.round(((statusMap['success'] ?? 0) / total) * 100);
    const splitRate = Math.round(((statusMap['split'] ?? 0) / total) * 100);
    const errorRate = Math.round(((statusMap['error'] ?? 0) / total) * 100);

    res.json({
      totalUsers,
      newUsers,
      tracksProcessed,
      operationsCount,
      featureUsage,
      splitsCount,
      avgTracksPerOp,
      successRate,
      splitRate,
      errorRate,
      topFeature,
    });
  } catch (err) {
    logger.error('[admin/stats] Error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/daily?period=7d|28d|90d
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
        WHERE "createdAt" >= ${cutoff}
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

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 28;
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
    logger.error('[admin/daily] Error:', err);
    res.status(500).json({ error: 'Failed to fetch daily data' });
  }
});

/**
 * GET /api/admin/operations?period=7d|28d|90d&limit=20
 *
 * Returns recent operation logs with user info for the recent operations table.
 */
router.get('/operations', authenticateUser, adminAuth, async (req, res) => {
  try {
    const period = validPeriod(req.query.period);
    const cutoff = periodToCutoff(period);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const logs = await prisma.operationLog.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    const operations = logs.map(log => ({
      id: log.id,
      user: {
        username: log.user.username,
        displayName: log.user.displayName,
        avatarUrl: log.user.avatarUrl,
      },
      action: log.action,
      actionName: ACTION_NAMES[log.action] || log.action,
      trackCount: log.trackCount,
      itemCount: log.itemCount,
      status: log.status,
      createdAt: log.createdAt.toISOString(),
      metadata: log.metadata,
    }));

    res.json({ operations });
  } catch (err) {
    logger.error('[admin/operations] Error:', err);
    res.status(500).json({ error: 'Failed to fetch operations' });
  }
});

export default router;
