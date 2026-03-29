import prisma from './prisma.js';
import logger from './logger.js';

/**
 * Fire-and-forget analytics log. Never throws, never blocks a response.
 * Call WITHOUT await so it doesn't delay the HTTP response.
 *
 * @param {object} params
 * @param {string} params.userId       - Prisma User.id (cuid string)
 * @param {string} params.action       - 'merge' | 'from-likes' | 'playlist-transfer' | 'bulk-unlike' | 'bulk-unfollow' |
 *                                       'resolve' | 'batch-resolve' | 'proxy-download' | 'bulk-remove-reposts'
 * @param {number} [params.trackCount] - Tracks processed (playlist/like ops)
 * @param {number} [params.itemCount]  - Items processed (unfollow, batch-resolve, etc.)
 * @param {string} [params.status]     - 'success' | 'split' | 'error'
 * @param {object} [params.metadata]   - Extra JSON blob
 */
export async function logOperation({
  userId,
  action,
  trackCount = 0,
  itemCount = 0,
  status = 'success',
  metadata = null,
}) {
  try {
    await prisma.operationLog.create({
      data: {
        userId,
        action,
        trackCount,
        itemCount,
        status,
        metadata: metadata ?? undefined,
      },
    });
  } catch (err) {
    // Never rethrow — analytics must never break the API
    logger.error('[analytics] Failed to log operation:', err.message);
  }
}
