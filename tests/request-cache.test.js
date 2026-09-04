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

describe('entry cap', () => {
  test('evicts the oldest entries once the cap is exceeded', () => {
    const cache = createRequestCache({ maxEntries: 3 });
    for (const n of [1, 2, 3, 4, 5]) {
      cache.set('likes', `user-${n}`, 'default', { n }, 60_000);
    }
    expect(cache.size()).toBe(3);
    // 1 and 2 were evicted; 3, 4, 5 survive.
    expect(cache.get('likes', 'user-1')).toBeUndefined();
    expect(cache.get('likes', 'user-2')).toBeUndefined();
    expect(cache.get('likes', 'user-5')).toEqual({ n: 5 });
  });

  test('refreshing an entry moves it to the back of the eviction order', () => {
    const cache = createRequestCache({ maxEntries: 2 });
    cache.set('likes', 'a', 'default', 1, 60_000);
    cache.set('likes', 'b', 'default', 2, 60_000);
    cache.set('likes', 'a', 'default', 11, 60_000); // refresh a
    cache.set('likes', 'c', 'default', 3, 60_000);  // should evict b, not a

    expect(cache.get('likes', 'a')).toBe(11);
    expect(cache.get('likes', 'b')).toBeUndefined();
    expect(cache.get('likes', 'c')).toBe(3);
  });
});
