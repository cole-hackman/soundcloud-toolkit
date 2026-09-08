function buildEntryKey(namespace, userId, key) {
  return `${namespace}::${userId}::${key}`;
}

/**
 * Entries here are whole SoundCloud collections — a large likes payload is
 * multiple megabytes — so an uncapped map is an unbounded memory leak scaled by
 * concurrent users. Insertion-ordered eviction is enough: entries are already
 * TTL-bounded, this only guards the pathological case.
 */
const DEFAULT_MAX_ENTRIES = 500;

export function createRequestCache({ maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const cache = new Map();

  function evictOverflow() {
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
  }

  function pruneExpired(now = Date.now()) {
    for (const [entryKey, entry] of cache.entries()) {
      if (!entry || entry.expiresAt <= now) {
        cache.delete(entryKey);
      }
    }
  }

  return {
    get(namespace, userId, key = 'default') {
      const entryKey = buildEntryKey(namespace, userId, key);
      const entry = cache.get(entryKey);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        cache.delete(entryKey);
        return undefined;
      }
      return entry.data;
    },

    set(namespace, userId, key = 'default', data, ttlMs) {
      pruneExpired();
      const entryKey = buildEntryKey(namespace, userId, key);
      // Delete first so a refreshed entry moves to the back of the insertion
      // order rather than keeping its original eviction position.
      cache.delete(entryKey);
      cache.set(entryKey, {
        data,
        expiresAt: Date.now() + ttlMs,
      });
      evictOverflow();
      return data;
    },

    /** Entry count. Exposed for tests and diagnostics. */
    size() {
      return cache.size;
    },

    invalidateNamespaceForUser(namespace, userId) {
      for (const entryKey of cache.keys()) {
        if (entryKey.startsWith(`${namespace}::${userId}::`)) {
          cache.delete(entryKey);
        }
      }
    },

    invalidateUser(userId) {
      for (const entryKey of cache.keys()) {
        if (entryKey.includes(`::${userId}::`)) {
          cache.delete(entryKey);
        }
      }
    },
  };
}

export const requestCache = createRequestCache();
