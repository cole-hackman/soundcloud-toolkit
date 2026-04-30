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
});


