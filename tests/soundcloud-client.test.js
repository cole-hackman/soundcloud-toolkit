import { jest } from '@jest/globals';
import { Response } from 'node-fetch';
// We will import the client file and monkey patch fetch
import { soundcloudClient } from '../server/lib/soundcloud-client.js';

describe('soundcloud client behaviors', () => {
  const endpoint = '/me';
  const okJson = { ok: true };

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('refreshes on 401 and retries once', async () => {
    const first = Promise.resolve(new Response('', { status: 401 }));
    const tokenResponse = Promise.resolve(new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2' }), { status: 200 }));
    const second = Promise.resolve(new Response(JSON.stringify(okJson), { status: 200 }));

    // order: first call 401, token refresh 200, retry 200
    fetch
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(tokenResponse)
      .mockReturnValueOnce(second);

    const res = await soundcloudClient.scRequest(endpoint, 'old', 'r1');
    expect(res).toEqual(okJson);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('backs off on 429 and retries', async () => {
    jest.useFakeTimers();
    const first = Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '1' } }));
    const second = Promise.resolve(new Response(JSON.stringify(okJson), { status: 200 }));
    fetch.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const p = soundcloudClient.scRequest(endpoint, 'a', 'r');
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    const res = await p;
    expect(res).toEqual(okJson);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('stops retrying after repeated 429 responses', async () => {
    jest.useFakeTimers();
    fetch
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 429 })))
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 429 })));

    const request = soundcloudClient.scRequest(endpoint, 'a', 'r', { max429Retries: 1 });
    await Promise.resolve();
    jest.advanceTimersByTime(1000);

    await expect(request).rejects.toThrow('API request failed: 429');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('refreshes download token only once on repeated 401 responses', async () => {
    fetch
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 401 })))
      .mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2' }), { status: 200 })))
      .mockReturnValueOnce(Promise.resolve(new Response('', { status: 401 })));

    await expect(
      soundcloudClient.getDownloadLink('old', 'r1', 'https://api.soundcloud.com/tracks/123/download')
    ).rejects.toThrow('Download request failed: 401');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('fetches a followed user liked tracks page with linked pagination', async () => {
    const payload = {
      collection: [{ id: 123, title: 'Track' }],
      next_href: 'https://api.soundcloud.com/users/42/likes/tracks?cursor=next',
      total_results: 10,
    };
    fetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })));

    const page = await soundcloudClient.getUserLikedTracksPage('a', 'r', 42, { limit: 25 });

    expect(page).toEqual(payload);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.soundcloud.com/users/42/likes/tracks?limit=25&linked_partitioning=1');
    expect(options.headers.Authorization).toBe('OAuth a');
  });

  test('continues a followed user liked tracks page from a next_href cursor', async () => {
    const payload = { collection: [{ id: 456, title: 'Next Track' }], next_href: null };
    const nextHref = 'https://api.soundcloud.com/users/42/likes/tracks?cursor=abc&limit=25';
    fetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })));

    const page = await soundcloudClient.getUserLikedTracksPage('a', 'r', 42, { next: nextHref });

    expect(page).toEqual(payload);
    const [url] = fetch.mock.calls[0];
    expect(url).toBe('https://api.soundcloud.com/users/42/likes/tracks?cursor=abc&limit=25');
  });

  test('fetches a followed user playlists page without embedded tracks', async () => {
    const payload = { collection: [{ id: 99, title: 'Set', track_count: 12 }], next_href: null };
    fetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })));

    await soundcloudClient.getUserPlaylistsPage('a', 'r', 42, { limit: 50 });

    const [url] = fetch.mock.calls[0];
    expect(url).toBe('https://api.soundcloud.com/users/42/playlists?limit=50&linked_partitioning=1&show_tracks=false');
  });

  // Regression guard: unfollowUser/unlikeTrack take tokens FIRST (unlike their
  // id-first inverses followUser/likeTrack). A swapped call sends the target id
  // as the OAuth token — the growth-reversal bug fixed in July 2026.
  describe('unfollow / unlike argument order', () => {
    test('unfollowUser targets the user id and authenticates with the access token', async () => {
      fetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(okJson), { status: 200 })));

      await soundcloudClient.unfollowUser('tok', 'ref', 42);

      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('https://api.soundcloud.com/me/followings/42');
      expect(options.method).toBe('DELETE');
      expect(options.headers.Authorization).toBe('OAuth tok');
    });

    test('unlikeTrack targets the track id and authenticates with the access token', async () => {
      fetch.mockReturnValueOnce(Promise.resolve(new Response(JSON.stringify(okJson), { status: 200 })));

      await soundcloudClient.unlikeTrack('tok', 'ref', 77);

      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe('https://api.soundcloud.com/likes/tracks/77');
      expect(options.method).toBe('DELETE');
      expect(options.headers.Authorization).toBe('OAuth tok');
    });
  });

  describe('paginate crawl bounds', () => {
    const page = (start, count, nextHref) => Promise.resolve(new Response(JSON.stringify({
      collection: Array.from({ length: count }, (_, i) => ({ id: start + i })),
      next_href: nextHref,
    }), { status: 200 }));

    test('follows next_href to exhaustion when no options are passed', async () => {
      fetch
        .mockReturnValueOnce(page(0, 2, 'https://api.soundcloud.com/x?cursor=2'))
        .mockReturnValueOnce(page(2, 1, null));

      const items = await soundcloudClient.paginate('/x', 'a', 'r', 2);

      expect(items).toHaveLength(3);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('stops at maxItems and slices an overshooting page', async () => {
      fetch.mockReturnValueOnce(page(0, 200, 'https://api.soundcloud.com/x?cursor=2'));

      const items = await soundcloudClient.paginate('/x', 'a', 'r', 200, { maxItems: 150 });

      expect(items).toHaveLength(150);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('retries a 429 page honoring Retry-After and continues crawling', async () => {
      jest.useFakeTimers();
      fetch
        .mockReturnValueOnce(Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '1' } })))
        .mockReturnValueOnce(page(0, 1, null));

      const p = soundcloudClient.paginate('/x', 'a', 'r', 50);
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      const items = await p;

      expect(items).toHaveLength(1);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('throws after exhausting 429 retries', async () => {
      jest.useFakeTimers();
      fetch
        .mockReturnValueOnce(Promise.resolve(new Response('', { status: 429 })))
        .mockReturnValueOnce(Promise.resolve(new Response('', { status: 429 })));

      const request = soundcloudClient.paginate('/x', 'a', 'r', 50, { max429Retries: 1 });
      await Promise.resolve();
      jest.advanceTimersByTime(1000);

      await expect(request).rejects.toThrow('API request failed: 429');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('stops at the deadline and returns the partial crawl', async () => {
      const t0 = Date.now();
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(t0)          // loop check before page 1: within budget
        .mockReturnValue(t0 + 100);       // every later check: past the deadline
      fetch.mockReturnValueOnce(page(0, 2, 'https://api.soundcloud.com/x?cursor=2'));

      const items = await soundcloudClient.paginate('/x', 'a', 'r', 2, { deadlineAt: t0 + 50 });

      expect(items).toHaveLength(2);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});


