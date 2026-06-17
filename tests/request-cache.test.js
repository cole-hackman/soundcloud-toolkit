import { jest } from '@jest/globals';
import { createRequestCache } from '../server/lib/request-cache.js';

describe('request cache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-12T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns cached values for the same namespace, user, and key until ttl expires', () => {
    const cache = createRequestCache();

    cache.set('likes', 'user-1', 'default', { collection: [1, 2] }, 60_000);

    expect(cache.get('likes', 'user-1', 'default')).toEqual({ collection: [1, 2] });

    jest.advanceTimersByTime(59_000);
    expect(cache.get('likes', 'user-1', 'default')).toEqual({ collection: [1, 2] });

    jest.advanceTimersByTime(2_000);
    expect(cache.get('likes', 'user-1', 'default')).toBeUndefined();
  });

  test('does not share cached values across users', () => {
    const cache = createRequestCache();

    cache.set('followings', 'user-1', 'default', { total: 10 }, 60_000);

    expect(cache.get('followings', 'user-1', 'default')).toEqual({ total: 10 });
    expect(cache.get('followings', 'user-2', 'default')).toBeUndefined();
  });

  test('invalidates all keys for a namespace and user', () => {
    const cache = createRequestCache();

    cache.set('playlists', 'user-1', 'default', { total: 3 }, 60_000);
    cache.set('playlists', 'user-1', 'limit=1', { total: 3 }, 60_000);
    cache.set('likes', 'user-1', 'default', { total: 20 }, 60_000);

    cache.invalidateNamespaceForUser('playlists', 'user-1');

    expect(cache.get('playlists', 'user-1', 'default')).toBeUndefined();
    expect(cache.get('playlists', 'user-1', 'limit=1')).toBeUndefined();
    expect(cache.get('likes', 'user-1', 'default')).toEqual({ total: 20 });
  });
});
