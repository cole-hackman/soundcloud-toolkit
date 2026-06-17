function buildEntryKey(namespace, userId, key) {
  return `${namespace}::${userId}::${key}`;
}

export function createRequestCache() {
  const cache = new Map();

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
      cache.set(buildEntryKey(namespace, userId, key), {
        data,
        expiresAt: Date.now() + ttlMs,
      });
      return data;
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
