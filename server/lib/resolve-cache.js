/** In-memory cache for /api/resolve results. Per-process; resets on restart
 * (documented limitation — single-instance deploy). */
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const RESOLVE_CACHE_MAX_ENTRIES = 1000;
const resolveCache = new Map(); // key: sanitized URL, value: { data, expiresAt }

function pruneResolveCache() {
  const now = Date.now();
  for (const [key, value] of resolveCache.entries()) {
    if (!value || value.expiresAt <= now) resolveCache.delete(key);
  }
  if (resolveCache.size <= RESOLVE_CACHE_MAX_ENTRIES) return;
  const overflow = resolveCache.size - RESOLVE_CACHE_MAX_ENTRIES;
  let removed = 0;
  for (const key of resolveCache.keys()) {
    resolveCache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function getCachedResolve(url) {
  const entry = resolveCache.get(url);
  if (!entry || entry.expiresAt <= Date.now()) return undefined;
  return entry.data;
}

export function setCachedResolve(url, data) {
  pruneResolveCache();
  resolveCache.set(url, { data, expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS });
}

export function resolveCacheSize() { return resolveCache.size; }
export function clearResolveCache() { resolveCache.clear(); }
