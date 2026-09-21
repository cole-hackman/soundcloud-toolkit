/**
 * Daily retention purge.
 *
 * Every row this service keeps has a stated lifetime; this is the job that
 * actually enforces them, rather than the privacy page describing a policy
 * nothing implements. It runs once ten minutes after boot and then daily.
 *
 * Design notes:
 *   - Each step is one bulk statement and is isolated: a step that throws is
 *     logged and the rest still run. A failing step must not be able to hold
 *     the whole policy hostage, and the next run retries it anyway.
 *   - Nothing here ever throws to its caller, so the interval cannot die.
 *   - The user deletes rely on the same onDelete: Cascade that the account
 *     deletion route relies on (tests/account-deletion-cascade.test.js), so
 *     removing a user row removes its tokens, logs, votes and cache pages.
 *   - Step 4 snapshots the lifetime distinct-user count BEFORE purging the
 *     logs it is computed from. Without that, the all-time figure would
 *     silently shrink every time rows aged out.
 *
 * Windows (env-overridable where the brief calls for it):
 *   library cache   CACHE_TTL_DAYS         7 days
 *   disconnected    (constant)             7 days
 *   inactive        INACTIVE_MONTHS        24 months
 *   operation logs  OPLOG_RETENTION_DAYS   365 days
 *   growth actions  (constant)             365 days
 *   feedback        (constant)             730 days
 */
import prisma from './prisma.js';
import logger from './logger.js';
import { safeError } from './safe-error.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const numFromEnv = (name, fallback) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

/** Grace period between a disconnect and the row being removed. Short on
 *  purpose — the tokens are already gone, so this is the window in which
 *  logging back in still restores the account rather than starting over. */
const DISCONNECTED_GRACE_DAYS = 7;
const GROWTH_RETENTION_DAYS = 365;
const FEEDBACK_RETENTION_DAYS = 730;

/** The counter that has to outlive the operation logs it is derived from. */
export const LIFETIME_METRIC_KEY = 'lifetime_distinct_users';

/** Ten minutes: long enough for a cold Neon compute and the first wave of
 *  requests to settle before a job that issues large deletes. */
const INITIAL_DELAY_MS = 10 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

const daysAgo = (now, days) => new Date(now - days * DAY_MS);

/** Calendar-month subtraction, not 30-day arithmetic: "24 months" in a privacy
 *  policy means the same date two years earlier.
 *
 *  UTC deliberately. Local-time setMonth shifts the cutoff by an hour whenever
 *  the window crosses a DST boundary, which would make the same input produce
 *  different cutoffs depending on the host's timezone and the time of year. */
function monthsAgo(now, months) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

/**
 * Run one step, logging its row count in the shape the whole job uses, and
 * swallowing its failure so the following steps still run.
 * @param {string} name  short identifier for the log line
 * @param {() => Promise<{count: number}|number|undefined>} fn
 * @param {object} results  accumulator, null for a step that failed
 * @param {string} [verb]  'removed' for the purges; the metric snapshot
 *   removes nothing, and saying it did in the one log that evidences this
 *   job ran correctly would be worse than a little asymmetry
 */
async function runStep(name, fn, results, verb = 'removed') {
  try {
    const outcome = await fn();
    const count = typeof outcome === 'number' ? outcome : (outcome?.count ?? 0);
    logger.info(`[retention] ${name} ${verb} ${count}`);
    results[name] = count;
  } catch (error) {
    logger.error(`[retention] ${name} failed:`, safeError(error));
    results[name] = null;
  }
}

/**
 * Snapshot the lifetime distinct-user count, then purge aged operation logs.
 *
 * The metric is monotonic: a run raises it to the current distinct count and
 * never lowers it, so the number survives every later purge. Expressed through
 * the Prisma API (`distinct`) rather than raw SQL — one row per distinct user
 * is a handful of kilobytes at this scale, and it keeps the query portable.
 */
async function snapshotLifetimeUsers() {
  const distinctRows = await prisma.operationLog.findMany({
    distinct: ['userId'],
    select: { userId: true },
  });
  const current = distinctRows.length;

  const stored = await prisma.metric.findUnique({ where: { key: LIFETIME_METRIC_KEY } });
  const previous = stored ? Number(stored.value) : 0;
  const next = Math.max(previous, current);

  await prisma.metric.upsert({
    where: { key: LIFETIME_METRIC_KEY },
    create: { key: LIFETIME_METRIC_KEY, value: BigInt(current) },
    update: { value: BigInt(next) },
  });

  return next;
}

/**
 * Execute the full sweep once. Exported so tests can drive it directly and so
 * an operator can trigger it from a REPL without waiting for the interval.
 *
 * @param {number} [now] epoch millis, injectable for deterministic tests
 * @returns {Promise<object>} per-step row counts (null where the step failed)
 */
export async function runRetentionOnce(now = Date.now()) {
  const results = {};

  // 1. Library cache tier. Pages are immutable once written, so they age by
  //    createdAt; the state row is rewritten on every sync, so it ages by
  //    updatedAt.
  const cacheCutoff = daysAgo(now, numFromEnv('CACHE_TTL_DAYS', 7));
  await runStep('library-cache-pages', () =>
    prisma.libraryCachePage.deleteMany({ where: { createdAt: { lt: cacheCutoff } } }), results);
  await runStep('library-cache-states', () =>
    prisma.libraryCacheState.deleteMany({ where: { updatedAt: { lt: cacheCutoff } } }), results);

  // 2. Accounts that disconnected and did not come back. Logging in clears
  //    disconnectedAt, so anything still stamped a week later is settled.
  const disconnectedCutoff = daysAgo(now, DISCONNECTED_GRACE_DAYS);
  await runStep('disconnected-users', () =>
    prisma.user.deleteMany({ where: { disconnectedAt: { lt: disconnectedCutoff } } }), results);

  // 3. Dormant accounts. Rows created before lastLoginAt existed have it null;
  //    updatedAt is the best available proxy for those, and the OAuth callback
  //    touches it on every login.
  const inactiveCutoff = monthsAgo(now, numFromEnv('INACTIVE_MONTHS', 24));
  await runStep('inactive-users', () =>
    prisma.user.deleteMany({
      where: {
        OR: [
          { lastLoginAt: { lt: inactiveCutoff } },
          { AND: [{ lastLoginAt: null }, { updatedAt: { lt: inactiveCutoff } }] },
        ],
      },
    }), results);

  // 4. Lifetime snapshot FIRST, then the log purge it protects.
  await runStep('lifetime-users-metric', () => snapshotLifetimeUsers(), results, 'snapshot');
  const oplogCutoff = daysAgo(now, numFromEnv('OPLOG_RETENTION_DAYS', 365));
  await runStep('operation-logs', () =>
    prisma.operationLog.deleteMany({ where: { createdAt: { lt: oplogCutoff } } }), results);

  // 5. Growth history.
  await runStep('growth-actions', () =>
    prisma.growthAction.deleteMany({
      where: { createdAt: { lt: daysAgo(now, GROWTH_RETENTION_DAYS) } },
    }), results);

  // 6. Feedback. Guarded: the model arrives with the feedback feature, and the
  //    job must still run on a client generated without it.
  await runStep('feedback', () => {
    if (!prisma.feedback) return { count: 0 };
    return prisma.feedback.deleteMany({
      where: { createdAt: { lt: daysAgo(now, FEEDBACK_RETENTION_DAYS) } },
    });
  }, results);

  // 7. The retired beta survey's email column is the only free-text PII left
  //    in a read-only table. Nulling it every run is cheap and idempotent, and
  //    keeps the aggregate rows without keeping the addresses.
  await runStep('beta-signup-emails', () =>
    prisma.betaSignup.updateMany({
      where: { email: { not: null } },
      data: { email: null },
    }), results);

  // 8. Catalog rows for tracks deleted upstream. The row stays as an opaque id
  //    so historical operations still resolve, but the cached metadata goes —
  //    keeping it is exactly the retention a delete-on-removal clause forbids
  //    (docs/internal/TERMS-CHECK.md, clause 2).
  await runStep('catalog-gone-metadata', () =>
    prisma.track.updateMany({
      where: { access: 'gone', title: { not: null } },
      data: {
        title: null,
        artistName: null,
        genre: null,
        genreNormalized: null,
        permalinkUrl: null,
      },
    }), results);

  return results;
}

/**
 * Start the daily sweep. Disable with RETENTION_ENABLED=false; anything else
 * (including unset) enables it, because a retention policy that is off by
 * default is not a policy.
 */
export function startRetentionScheduler() {
  if (process.env.RETENTION_ENABLED === 'false') {
    logger.info('[retention] Disabled via RETENTION_ENABLED=false');
    return null;
  }

  const intervalMs = numFromEnv('RETENTION_INTERVAL_MS', DEFAULT_INTERVAL_MS);
  const run = () =>
    runRetentionOnce().catch((err) => logger.error('[retention] Run failed:', safeError(err)));

  setTimeout(run, INITIAL_DELAY_MS);
  const interval = setInterval(run, intervalMs);
  interval.unref?.();
  logger.info('[retention] Daily purge scheduled');
  return interval;
}
