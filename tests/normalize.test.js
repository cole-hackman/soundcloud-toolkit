const {
  extractNumericId,
  normalizeResource,
  normalizeTrackForLibraryBrowser,
  normalizePlaylistForLibraryBrowser,
} = await import('../server/lib/normalize.js');

describe('extractNumericId', () => {
  test('passes numbers through', () => expect(extractNumericId(42)).toBe(42));
  test('parses numeric strings', () => expect(extractNumericId('42')).toBe(42));
  test('parses SoundCloud URNs', () => expect(extractNumericId('soundcloud:tracks:123')).toBe(123));
  test('returns undefined for junk', () => expect(extractNumericId('abc')).toBeUndefined());
});

describe('normalizeResource', () => {
  test('normalizes a track', () => {
    const out = normalizeResource({
      kind: 'track', id: 5, title: 'T', duration: 1000,
      user: { id: 9, username: 'dj' }, permalink_url: 'https://soundcloud.com/dj/t',
    });
    expect(out).toMatchObject({ type: 'track', id: 5, title: 'T', duration_ms: 1000 });
    expect(out.user).toEqual({ id: 9, username: 'dj' });
  });
  test('falls back through wrapper objects', () => {
    const out = normalizeResource({ track: { id: 7, title: 'W', user: {} } });
    expect(out).toMatchObject({ type: 'track', id: 7 });
  });
  test('returns null for unrecognizable input', () => {
    expect(normalizeResource({})).toBeNull();
  });
});

describe('library-browser normalizers', () => {
  test('track requires a numeric id', () => {
    expect(normalizeTrackForLibraryBrowser({ title: 'no id' })).toBeNull();
  });
  test('playlist artwork falls back to first track artwork', () => {
    const out = normalizePlaylistForLibraryBrowser({
      id: 7, title: 'P', tracks: [{ artwork_url: 'a.jpg' }],
    });
    expect(out.artwork_url).toBe('a.jpg');
    expect(out.track_count).toBe(1);
  });
});
