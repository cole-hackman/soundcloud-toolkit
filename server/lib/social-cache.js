/**
 * Per-user request-scoped caches for the authenticated user's SoundCloud
 * social/library payloads. Shared by the core API routes and the growth
 * suite so whichever runs first warms the cache for the other.
 */
import { requestCache } from './request-cache.js';
import { soundcloudClient } from './soundcloud-client.js';

export const CACHE_TTL = {
  playlists: 5 * 60 * 1000,
  followings: 5 * 60 * 1000,
  followers: 5 * 60 * 1000,
  likes: 60 * 1000,
  reposts: 60 * 1000,
  activities: 60 * 1000,
};

export function getCachedUserPayload(namespace, userId, key, load, ttlMs) {
  const cached = requestCache.get(namespace, userId, key);
  if (cached !== undefined) return Promise.resolve(cached);
  return Promise.resolve(load()).then((data) => {
    requestCache.set(namespace, userId, key, data, ttlMs);
    return data;
  });
}

export function invalidateUserNamespaces(userId, namespaces) {
  namespaces.forEach((namespace) => {
    requestCache.invalidateNamespaceForUser(namespace, userId);
  });
}

/* Shared cached loaders for the auth user's social lists. The GET routes and
 * growth discovery use the same namespace/key/payload shape, so whichever
 * runs first warms the cache for the other. */
export function loadCachedFollowings(req) {
  return getCachedUserPayload('followings', req.user.id, 'default', async () => {
    const followings = await soundcloudClient.getFollowings(req.accessToken, req.refreshToken);
    return { collection: followings, total: followings.length };
  }, CACHE_TTL.followings);
}

export function loadCachedFollowers(req) {
  return getCachedUserPayload('followers', req.user.id, 'default', async () => {
    const followers = await soundcloudClient.getFollowers(req.accessToken, req.refreshToken);
    return { collection: followers, total: followers.length };
  }, CACHE_TTL.followers);
}

export function invalidatePlaylistState(userId) {
  invalidateUserNamespaces(userId, ['playlists']);
}
