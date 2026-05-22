import {
  sanitizeSoundcloudUrl,
  normalizeResolveResult,
  resolveSoundcloudUrl,
} from '../server/lib/resolve-soundcloud-url.js';

describe('sanitizeSoundcloudUrl', () => {
  test('accepts soundcloud.com and strips tracking params', () => {
    expect(sanitizeSoundcloudUrl('https://soundcloud.com/artist/track?si=abc&utm_source=fb')).toBe(
      'https://soundcloud.com/artist/track',
    );
  });
  test('adds https scheme if missing', () => {
    expect(sanitizeSoundcloudUrl('soundcloud.com/artist')).toBe('https://soundcloud.com/artist');
  });
  test('rejects non-soundcloud hosts', () => {
    expect(sanitizeSoundcloudUrl('https://spotify.com/x')).toBe('');
  });
  test('accepts on.soundcloud.com short links', () => {
    expect(sanitizeSoundcloudUrl('https://on.soundcloud.com/abc')).toBe('https://on.soundcloud.com/abc');
  });
  test('returns "" for empty/garbage', () => {
    expect(sanitizeSoundcloudUrl('')).toBe('');
    expect(sanitizeSoundcloudUrl('::not a url::')).toBe('');
  });
});

describe('normalizeResolveResult', () => {
  test('normalizes a track', () => {
    const res = normalizeResolveResult({
      kind: 'track',
      id: 12,
      title: 'X',
      duration: 1000,
      genre: 'Tech House',
      permalink_url: 'http://soundcloud.com/x',
      user: { id: 1, username: 'a' },
    });
    expect(res).toEqual({
      type: 'track',
      id: 12,
      title: 'X',
      username: 'a',
      duration_ms: 1000,
      genre: 'Tech House',
      permalink_url: 'http://soundcloud.com/x',
      artwork_url: undefined,
    });
  });
  test('returns null for unrecognized resources', () => {
    expect(normalizeResolveResult({ kind: 'weird' })).toBeNull();
    expect(normalizeResolveResult(null)).toBeNull();
  });
});

describe('resolveSoundcloudUrl', () => {
  test('uses authenticated resolve and normalizes the response', async () => {
    const fakeSc = {
      resolveAny: async () => ({ kind: 'track', id: 1, title: 'T', user: { id: 9, username: 'u' } }),
      resolvePublic: async () => { throw new Error('should not be called'); },
    };
    const result = await resolveSoundcloudUrl('https://soundcloud.com/u/t', 'a', 'r', { sc: fakeSc });
    expect(result.type).toBe('track');
    expect(result.id).toBe(1);
  });

  test('falls back to public resolver on 401', async () => {
    const fakeSc = {
      resolveAny: async () => { throw new Error('401 unauthorized'); },
      resolvePublic: async () => ({ kind: 'user', id: 5, username: 'x', followers_count: 10 }),
    };
    const result = await resolveSoundcloudUrl('https://soundcloud.com/x', 'a', 'r', { sc: fakeSc });
    expect(result.type).toBe('user');
    expect(result.username).toBe('x');
  });

  test('throws on invalid URL', async () => {
    await expect(resolveSoundcloudUrl('not-a-url', 'a', 'r', { sc: {} })).rejects.toThrow(/Invalid/);
  });
});
