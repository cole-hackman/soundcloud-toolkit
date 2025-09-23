import { jest } from '@jest/globals';
import { Response } from 'node-fetch';
// We will import the client file and monkey patch fetch
import { soundcloudClient } from '../server/lib/soundcloud-client.js';

describe('soundcloud client behaviors', () => {
  const endpoint = '/me';
  const okJson = { ok: true };

  beforeEach(() => {
    global.fetch = jest.fn();
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
});


