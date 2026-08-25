import { jest } from '@jest/globals';

process.env.SC_FETCH_TIMEOUT_MS = '50'; // must be set before the module loads
process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);

// fetch mock that never resolves but honors AbortController
global.fetch = jest.fn(
  (url, options = {}) =>
    new Promise((resolve, reject) => {
      if (options.signal) {
        options.signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      }
    })
);

const { soundcloudClient } = await import('../server/lib/soundcloud-client.js');

test('a hanging SoundCloud request aborts at the timeout instead of hanging forever', async () => {
  await expect(
    soundcloudClient.scRequest('/me', 'access', 'refresh')
  ).rejects.toThrow(/abort/i);
  // the fetch call actually received an abort signal
  expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
}, 5000);
