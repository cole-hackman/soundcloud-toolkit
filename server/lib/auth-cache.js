/**
 * Short-lived memo of the authenticated principal.
 *
 * `authenticateUser` runs on every API request and does a Neon round trip
 * (`user.findUnique` with tokens) plus two AES-GCM decrypts. On a paged browse
 * that is one extra database round trip per page, dwarfing the work the route
 * itself does.
 *
 * This is deliberately conservative, because the entries hold DECRYPTED tokens:
 *   - the TTL is seconds, not minutes;
 *   - entries are keyed strictly by the session's userId, so no request can
 *     ever read another user's entry;
 *   - the cache is dropped the moment tokens rotate (see the refresh path in
 *     soundcloud-client.js) or the account is deleted.
 *
 * It is a latency optimisation only. A miss is always correct; the worst case
 * of dropping the whole cache is the behaviour that existed before it.
 */
const DEFAULT_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS) || 30_000;

// Bounded so a burst of distinct sessions cannot grow this without limit.
const MAX_ENTRIES = 1000;

const entries = new Map();

export function getCachedAuth(userId, now = Date.now()) {
  const entry = entries.get(userId);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    entries.delete(userId);
    return undefined;
  }
  return entry.value;
}

export function setCachedAuth(userId, value, ttlMs = DEFAULT_TTL_MS, now = Date.now()) {
  entries.delete(userId);
  entries.set(userId, { value, expiresAt: now + ttlMs });
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) break;
    entries.delete(oldest.value);
  }
  return value;
}

/**
 * Drop a user's memo. Called wherever the stored tokens or the user row stop
 * being what the memo says they are — token refresh and account deletion.
 */
export function invalidateCachedAuth(userId) {
  if (userId != null) entries.delete(userId);
}

/** Drop everything. Used by tests. */
export function clearAuthCache() {
  entries.clear();
}

export function authCacheSize() {
  return entries.size;
}
