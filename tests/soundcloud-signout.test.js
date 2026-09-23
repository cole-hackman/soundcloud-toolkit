import { jest } from '@jest/globals';
import { Response } from 'node-fetch';

process.env.ENCRYPTION_KEY ||= 'x'.repeat(32);

const { signOut, isInvalidGrantResponse } = await import('../server/lib/soundcloud-client.js');

const originalFetch = global.fetch;
// signOut logs every failure at warn by design — all four failure tests below
// trip it, so silence it rather than burying the run in expected warnings.
const quietWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

afterAll(() => { global.fetch = originalFetch; quietWarn.mockRestore(); });
beforeEach(() => { global.fetch = jest.fn(); quietWarn.mockClear(); });

describe('signOut', () => {
  test('POSTs to the sign-out endpoint with the access token', async () => {
    fetch.mockResolvedValue(new Response('', { status: 200 }));

    await expect(signOut('live-token')).resolves.toBe(true);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.soundcloud.com/sign-out');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('OAuth live-token');
  });

  test('carries its own short deadline, not the 30s fetch budget', async () => {
    fetch.mockImplementation((_url, options = {}) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      })
    );

    // If this used SC_FETCH_TIMEOUT_MS it would outlive the 5s jest default.
    await expect(signOut('live-token')).resolves.toBe(false);
  }, 10_000);

  test('never throws on an upstream error', async () => {
    fetch.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(signOut('live-token')).resolves.toBe(false);
    expect(quietWarn).toHaveBeenCalled();
  });

  test('never throws on a network failure', async () => {
    fetch.mockImplementation(() => Promise.reject(new Error('ECONNRESET')));
    await expect(signOut('live-token')).resolves.toBe(false);
  });

  test('is a no-op without a token — nothing is sent', async () => {
    await expect(signOut(undefined)).resolves.toBe(false);
    await expect(signOut('')).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('isInvalidGrantResponse', () => {
  test('invalid_grant on 400 or 401 is revocation', () => {
    expect(isInvalidGrantResponse(400, '{"error":"invalid_grant"}')).toBe(true);
    expect(isInvalidGrantResponse(401, '{"error":"invalid_grant"}')).toBe(true);
  });

  test('a 401 with an empty body is revocation', () => {
    expect(isInvalidGrantResponse(401, '')).toBe(true);
    expect(isInvalidGrantResponse(401, '   ')).toBe(true);
    expect(isInvalidGrantResponse(401, undefined)).toBe(true);
  });

  test('a 401 with a non-empty non-JSON body is NOT revocation', () => {
    // An HTML error page from a proxy or WAF in front of the token endpoint
    // is far likelier than a revocation, and acting on it would destroy a
    // live user's tokens because of someone else's infrastructure.
    expect(isInvalidGrantResponse(401, '<html><body>502 Bad Gateway</body></html>')).toBe(false);
    expect(isInvalidGrantResponse(401, 'Unauthorized')).toBe(false);
    expect(isInvalidGrantResponse(401, '<!DOCTYPE html>')).toBe(false);
  });

  test('a 400 with no parsable body is NOT revocation', () => {
    // A bare 400 is too ambiguous to log someone out over.
    expect(isInvalidGrantResponse(400, '')).toBe(false);
    expect(isInvalidGrantResponse(400, 'Bad Request')).toBe(false);
    expect(isInvalidGrantResponse(400, '<html>nope</html>')).toBe(false);
  });

  test('another OAuth error code is not revocation', () => {
    expect(isInvalidGrantResponse(400, '{"error":"invalid_client"}')).toBe(false);
    expect(isInvalidGrantResponse(401, '{"error":"invalid_client"}')).toBe(false);
  });

  test('transient statuses are never revocation, whatever the body says', () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isInvalidGrantResponse(status, '{"error":"invalid_grant"}')).toBe(false);
    }
  });
});
