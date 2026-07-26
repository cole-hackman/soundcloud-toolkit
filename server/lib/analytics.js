import prisma from './prisma.js';
import logger from './logger.js';

/**
 * Returns a function that, when called, returns the elapsed time in milliseconds.
 *
 * Usage:
 *   const elapsed = startOperationTimer();
 *   // ... work ...
 *   logOperation({ userId, action, durationMs: elapsed(), ... });
 *
 * @returns {() => number} Elapsed milliseconds
 */
export function startOperationTimer() {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Extract lightweight client/environment metadata from express request headers.
 *
 * @param {import('express').Request} req
 * @returns {object|null}
 */
export function extractClientInfo(req) {
  if (!req) return null;
  const ua = req.headers['user-agent'] || '';
  const isMobile = /mobile|android|iphone|ipad/i.test(ua);
  let browser = 'other';
  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'firefox';
  else if (/edg/i.test(ua)) browser = 'edge';

  let platform = 'other';
  if (/iphone|ipad|ipod/i.test(ua)) platform = 'ios';
  else if (/android/i.test(ua)) platform = 'android';
  else if (/macintosh|mac os x/i.test(ua)) platform = 'mac';
  else if (/windows/i.test(ua)) platform = 'windows';
  else if (/linux/i.test(ua)) platform = 'linux';

  return {
    device: isMobile ? 'mobile' : 'desktop',
    browser,
    platform,
  };
}

/**
 * Fire-and-forget analytics log. Never throws, never blocks a response.
 * Call WITHOUT await so it doesn't delay the HTTP response.
 *
 * @param {object} params
 * @param {string} [params.userId]       - Prisma User.id (cuid string)
 * @param {number} [params.soundcloudId] - SoundCloud numeric user ID
 * @param {import('express').Request} [params.req] - Express request object (auto-extracts user & client info)
 * @param {string} params.action       - An operation slug, or `view:<feature>` for a feature-open event.
 * @param {number} [params.trackCount] - Tracks processed (playlist/like ops)
 * @param {number} [params.itemCount]  - Items processed (unfollow, batch-resolve, etc.)
 * @param {number[]} [params.trackIds] - Operated track IDs
 * @param {number[]} [params.playlistIds] - Operated playlist IDs
 * @param {number[]} [params.targetUserIds] - Operated target user IDs
 * @param {string} [params.status]     - 'success' | 'split' | 'error'
 * @param {number} [params.durationMs] - Execution duration in ms
 * @param {string} [params.errorCode]  - Error identifier if status is 'error'
 * @param {string} [params.errorMessage] - Human-readable error details
 * @param {object} [params.metadata]   - Action-specific structured JSON metadata
 * @param {object} [params.clientInfo] - Client/device metadata
 */
export async function logOperation({
  userId = null,
  soundcloudId = null,
  req = null,
  action,
  trackCount = 0,
  itemCount = 0,
  trackIds = null,
  playlistIds = null,
  targetUserIds = null,
  status = 'success',
  durationMs = null,
  errorCode = null,
  errorMessage = null,
  metadata = null,
  clientInfo = null,
}) {
  try {
    // Resolve userId & soundcloudId from req if provided
    const resolvedUserId = userId || req?.user?.id || null;
    const resolvedSoundcloudId = soundcloudId ?? (req?.user?.soundcloudId ? Number(req.user.soundcloudId) : null);
    const resolvedClientInfo = clientInfo || (req ? extractClientInfo(req) : null);

    if (!resolvedUserId) {
      logger.warn('[analytics] Log attempt missing userId:', action);
      return;
    }

    // Sanitize errorMessage if present (strip secrets/tokens)
    let sanitizedErrorMsg = errorMessage;
    if (sanitizedErrorMsg && typeof sanitizedErrorMsg === 'string') {
      sanitizedErrorMsg = sanitizedErrorMsg
        .replace(/(?:token|secret|key|password)=[^&\s]+/gi, '[REDACTED]')
        .slice(0, 500); // cap length
    }

    // Merge trackIds, playlistIds, targetUserIds into metadata JSON
    const mergedMetadata = {
      ...(metadata || {}),
    };
    if (Array.isArray(trackIds) && trackIds.length > 0) {
      mergedMetadata.trackIds = trackIds.map(Number).filter(n => !isNaN(n)).slice(0, 500); // cap size
    }
    if (Array.isArray(playlistIds) && playlistIds.length > 0) {
      mergedMetadata.playlistIds = playlistIds.map(Number).filter(n => !isNaN(n));
    }
    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      mergedMetadata.targetUserIds = targetUserIds.map(Number).filter(n => !isNaN(n));
    }

    await prisma.operationLog.create({
      data: {
        userId: resolvedUserId,
        soundcloudId: resolvedSoundcloudId,
        action,
        trackCount: trackCount || (Array.isArray(trackIds) ? trackIds.length : 0),
        itemCount: itemCount || (Array.isArray(playlistIds) ? playlistIds.length : Array.isArray(targetUserIds) ? targetUserIds.length : 0),
        status,
        durationMs: typeof durationMs === 'number' ? Math.max(0, Math.round(durationMs)) : undefined,
        errorCode: errorCode ?? undefined,
        errorMessage: sanitizedErrorMsg ?? undefined,
        metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        clientInfo: resolvedClientInfo ?? undefined,
      },
    });
  } catch (err) {
    // Never rethrow — analytics must never break the API
    logger.error('[analytics] Failed to log operation:', err.message);
  }
}
