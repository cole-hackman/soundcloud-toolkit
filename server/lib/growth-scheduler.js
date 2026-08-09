import prisma from './prisma.js';
import logger from './logger.js';
import { decrypt } from './crypto.js';
import { safeError } from './safe-error.js';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const INITIAL_DELAY_MS = 5 * 60 * 1000; // let the server settle first
const MIN_FOLLOW_AGE_MS = 2 * 24 * 60 * 60 * 1000; // give people time to reciprocate
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;
const USER_CHECK_DELAY_MS = 400;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Scheduled follow-back verification. Finds users with pending growth
 * follows, refreshes their follower list once, and marks reciprocation —
 * the same logic as POST /api/growth/check-followbacks, run daily so the
 * history stays fresh without the user clicking anything.
 */
export async function runScheduledFollowbackChecks(soundcloudClient) {
  const cutoffCreated = new Date(Date.now() - MIN_FOLLOW_AGE_MS);
  const cutoffChecked = new Date(Date.now() - RECHECK_AFTER_MS);

  const pending = await prisma.growthAction.findMany({
    where: {
      actionType: 'follow',
      reversed: false,
      createdAt: { lte: cutoffCreated },
      OR: [
        { checkedAt: null },
        { AND: [{ checkedAt: { lte: cutoffChecked } }, { followedBack: null }] },
      ],
    },
    select: { id: true, userId: true, targetId: true },
  });

  if (pending.length === 0) return { usersChecked: 0, actionsChecked: 0 };

  const byUser = new Map();
  for (const action of pending) {
    if (!byUser.has(action.userId)) byUser.set(action.userId, []);
    byUser.get(action.userId).push(action);
  }

  let usersChecked = 0;
  let actionsChecked = 0;
  let hasFetchedFollowers = false;

  for (const [userId, actions] of byUser) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tokens: true },
      });
      if (!user || !user.tokens.length) continue;

      const token = user.tokens[0];
      const accessToken = decrypt(token.encrypted, process.env.ENCRYPTION_KEY);
      const refreshToken = decrypt(token.refresh, process.env.ENCRYPTION_KEY);

      if (hasFetchedFollowers) await sleep(USER_CHECK_DELAY_MS);
      const followers = await soundcloudClient.getFollowers(accessToken, refreshToken);
      hasFetchedFollowers = true;
      const followerIds = new Set(followers.map((f) => f.id));

      for (const action of actions) {
        await prisma.growthAction.update({
          where: { id: action.id },
          data: {
            followedBack: followerIds.has(Number(action.targetId)),
            checkedAt: new Date(),
          },
        });
        actionsChecked++;
      }
      usersChecked++;
    } catch (err) {
      logger.error(`[GrowthScheduler] Follow-back check failed for user ${userId}:`, safeError(err));
    }
  }

  logger.info(`[GrowthScheduler] Checked ${actionsChecked} follows across ${usersChecked} users`);
  return { usersChecked, actionsChecked };
}

/**
 * Start the daily follow-back scheduler. Disable with GROWTH_AUTOCHECK=false.
 */
export function startGrowthScheduler(soundcloudClient) {
  if (process.env.GROWTH_AUTOCHECK === 'false') {
    logger.info('[GrowthScheduler] Disabled via GROWTH_AUTOCHECK=false');
    return null;
  }

  const run = () =>
    runScheduledFollowbackChecks(soundcloudClient).catch((err) =>
      logger.error('[GrowthScheduler] Run failed:', safeError(err))
    );

  setTimeout(run, INITIAL_DELAY_MS);
  const interval = setInterval(run, CHECK_INTERVAL_MS);
  interval.unref?.();
  logger.info('[GrowthScheduler] Daily follow-back checks scheduled');
  return interval;
}
