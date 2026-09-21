/**
 * Disconnecting an account — the step between logging out and deleting.
 *
 * Logout forgets the session cookie and nothing else: the encrypted token pair
 * stays in the database and the next login picks it straight back up. Deletion
 * is the other extreme and is irreversible. Disconnect is the middle: the
 * SoundCloud grant is handed back, the stored tokens are destroyed, and the
 * user row is stamped so the retention job removes it a week later unless the
 * person comes back (a successful login clears the stamp).
 *
 * Two callers:
 *   - POST /api/auth/disconnect, with the user's access token, so SoundCloud
 *     is told as well;
 *   - the refresh choke point in soundcloud-client.js, when SoundCloud reports
 *     the authorization already revoked — no access token, nothing to sign out
 *     of, but exactly the same local teardown.
 */
import prisma from './prisma.js';
import logger from './logger.js';
import { signOut } from './soundcloud-client.js';
import { invalidateCachedAuth } from './auth-cache.js';
import { requestCache } from './request-cache.js';
import { dropSnapshots } from './snapshot-cache.js';
import { dropInvalidationMarks } from './social-cache.js';

/**
 * Hand back the SoundCloud grant and destroy everything this process or the
 * database holds on that user's behalf, short of the account itself.
 *
 * @param {string} userId                internal User.id
 * @param {object} [options]
 * @param {string} [options.accessToken] present only when the token is still
 *   believed live; omitted on the revocation path
 * @param {string} [options.reason]      'user' | 'revoked' — logged, not stored
 */
export async function disconnectUser(userId, { accessToken, reason } = {}) {
  if (!userId) throw new Error('disconnectUser requires a userId');

  // Best-effort and non-throwing by construction (see signOut). Done first, so
  // the token is still readable from the caller when we use it.
  if (accessToken) await signOut(accessToken);

  // deleteMany, not delete: the token row may already be gone (a second
  // disconnect, or a revocation racing a manual one) and that is not an error.
  await prisma.token.deleteMany({ where: { userId } });

  await prisma.user.update({
    where: { id: userId },
    data: { disconnectedAt: new Date() },
  });

  // The auth memo holds DECRYPTED tokens for 30s. Without this, requests
  // arriving in that window would keep working against tokens that no longer
  // exist in the database — the landmine documented in STATE.md.
  invalidateCachedAuth(userId);

  // Their library payloads are derived from the grant we just gave back, so
  // nothing about them should outlive it in memory or in the durable tier.
  requestCache.invalidateUser(userId);
  dropInvalidationMarks(userId);
  await dropSnapshots(userId);

  // No identifiers: the reason is the only thing worth correlating, and
  // per-account logging is what the account-deletion path deliberately avoids.
  logger.info('[account] disconnected', { reason });
}
