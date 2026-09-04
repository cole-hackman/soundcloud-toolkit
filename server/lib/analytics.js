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
 * Express middleware that records how long a READ endpoint took and how many
 * SoundCloud round trips it cost.
 *
 * The mutating routes already call `logOperation` by hand, but the endpoints
 * users actually wait on — the full-library crawls behind /likes, /playlists,
 * /followings, /reposts and /library/audit — were uninstrumented, so there was
 * no way to rank tools by real latency. The write is fire-and-forget, and the
 * `read:` prefix keeps these rows out of the operation aggregates (see
 * routes/admin.js) while still feeding the latency panel.
 *
 * Mount AFTER authenticateUser so req.user is populated by the time the
 * 'finish' listener runs.
 *
 * @param {string} action - Bare action name; stored as `read:<action>`.
 */
export function instrumentRead(action) {
  return function instrumentedRead(req, res, next) {
    const elapsed = startOperationTimer();
    res.on('finish', () => {
      logOperation({
        req,
        action: `read:${action}`,
        status: res.statusCode >= 400 ? 'error' : 'success',
        durationMs: elapsed(),
        metadata: { scCalls: req.scMetrics?.scCalls ?? 0 },
      });
    });
    next();
  };
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

// Status vocabulary. 'split' means ONLY "output auto-divided at the 500-track
// playlist cap" (merge/clone/from-likes/followed-likes-to-playlist).
// 'partial' means "some items succeeded, some failed" (growth-reverse,
// followed-playlist-clone). Anything else is coerced to 'error' so bad call
// sites surface in the dashboard instead of corrupting stats.
const VALID_STATUSES = new Set(['success', 'split', 'error', 'partial']);

// trackIds stored per row are capped; when sliced, metadata carries
// trackIdsTruncated: true and trackIdsTotal with the real count.
const TRACK_IDS_CAP = 1000;

// In-process write-health signal, surfaced via GET /api/admin/stats.
// The logger still never throws into a user request; this is how schema
// drift or DB trouble becomes visible instead of silently eating rows.
const writeHealth = {
  failures: 0,
  lastFailureAt: null,
  lastFailureMessage: null,
  lastWriteAt: null,
};

export function getAnalyticsWriteHealth() {
  return { ...writeHealth };
}

/**
 * Fire-and-forget analytics log. Never throws, never blocks a response.
 * Call WITHOUT await so it doesn't delay the HTTP response.
 *
 * Metadata contract (enforced/normalized here, composed at call sites):
 * - ID arrays go in the dedicated args (trackIds/playlistIds/targetUserIds),
 *   never hand-rolled into metadata.
 * - Per-item bulk ops put counts in metadata as { total, succeeded, failed }.
 * - merge adds { mode: 'into-existing'|'split'|'new', sourceCount, totalTracks,
 *   playlistsCreated, ... }.
 * - All-items-failed outcomes log status 'error' with errorCode
 *   'ALL_ITEMS_FAILED' and the first per-item error as errorMessage.
 * - Catch paths can't see try-scoped arrays; they pass IDs from req.body.
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
 * @param {string} [params.status]     - 'success' | 'split' | 'error' | 'partial'
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

    // Enforce the status enum; unknown values become visible errors, not stats noise
    let resolvedStatus = status;
    if (!VALID_STATUSES.has(resolvedStatus)) {
      logger.warn(`[analytics] Invalid status "${resolvedStatus}" for action "${action}" — coercing to error`);
      resolvedStatus = 'error';
      errorCode = errorCode || 'INVALID_STATUS';
      metadata = { ...(metadata || {}), invalidStatus: String(status) };
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
      const cleanTrackIds = trackIds.map(Number).filter(n => !isNaN(n));
      if (cleanTrackIds.length > TRACK_IDS_CAP) {
        mergedMetadata.trackIds = cleanTrackIds.slice(0, TRACK_IDS_CAP);
        mergedMetadata.trackIdsTruncated = true;
        mergedMetadata.trackIdsTotal = cleanTrackIds.length;
      } else {
        mergedMetadata.trackIds = cleanTrackIds;
      }
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
        status: resolvedStatus,
        durationMs: typeof durationMs === 'number' ? Math.max(0, Math.round(durationMs)) : undefined,
        errorCode: errorCode ?? undefined,
        errorMessage: sanitizedErrorMsg ?? undefined,
        metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        clientInfo: resolvedClientInfo ?? undefined,
      },
    });
    writeHealth.lastWriteAt = new Date().toISOString();
  } catch (err) {
    // Never rethrow — analytics must never break the API. But count and
    // remember the failure so the admin dashboard can show data is being lost.
    writeHealth.failures += 1;
    writeHealth.lastFailureAt = new Date().toISOString();
    writeHealth.lastFailureMessage = String(err.message || err).slice(0, 300);
    logger.error('[analytics] Failed to log operation:', err);
  }
}
