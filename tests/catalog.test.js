import { mapTrackForCatalog, mapPlaylistForCatalog, normalizeGenre } from '../server/lib/catalog.js';

describe('catalog mapping', () => {
  describe('normalizeGenre', () => {
    it('lowercases and trims', () => {
      expect(normalizeGenre('  Tech House ')).toBe('tech house');
    });
    it('returns null for empty or non-string', () => {
      expect(normalizeGenre('   ')).toBeNull();
      expect(normalizeGenre(null)).toBeNull();
      expect(normalizeGenre(42)).toBeNull();
    });
  });

  describe('mapTrackForCatalog', () => {
    it('maps a raw SoundCloud track object', () => {
      const row = mapTrackForCatalog({
        id: 2312841341, // > int32 on purpose
        title: 'My Destiny (Original Mix)',
        user: { id: 1578422, username: 'Mike Delinquent' },
        genre: 'Dance',
        duration: 224034,
        access: 'preview',
        permalink_url: 'https://soundcloud.com/x/y',
      });
      expect(row).toEqual({
        id: 2312841341,
        title: 'My Destiny (Original Mix)',
        artistName: 'Mike Delinquent',
        artistId: 1578422,
        genre: 'Dance',
        genreNormalized: 'dance',
        durationMs: 224034,
        access: 'preview',
        permalinkUrl: 'https://soundcloud.com/x/y',
      });
    });

    it('maps a normalizeResource() shape (duration_ms)', () => {
      const row = mapTrackForCatalog({
        id: 123,
        title: 'T',
        user: { id: 9, username: 'artist' },
        duration_ms: 1000,
      });
      expect(row.durationMs).toBe(1000);
      expect(row.access).toBeNull();
    });

    it('rejects objects without a usable numeric id', () => {
      expect(mapTrackForCatalog(null)).toBeNull();
      expect(mapTrackForCatalog({})).toBeNull();
      expect(mapTrackForCatalog({ id: 'soundcloud:tracks:1' })).toBeNull();
      expect(mapTrackForCatalog({ id: -5 })).toBeNull();
    });

    it('treats blank titles as missing so upserts stay pending', () => {
      expect(mapTrackForCatalog({ id: 1, title: '   ' }).title).toBeNull();
    });
  });

  describe('mapPlaylistForCatalog', () => {
    it('maps id, title, owner and track count', () => {
      const row = mapPlaylistForCatalog({
        id: 2241372182,
        title: 'Study Beats',
        user: { id: 77 },
        track_count: 91,
      });
      expect(row).toEqual({ id: 2241372182, title: 'Study Beats', ownerScId: 77, trackCount: 91 });
    });

    it('falls back to tracks array length for count', () => {
      expect(mapPlaylistForCatalog({ id: 1, tracks: [{}, {}, {}] }).trackCount).toBe(3);
    });

    it('rejects missing ids', () => {
      expect(mapPlaylistForCatalog({ title: 'no id' })).toBeNull();
    });
  });
});
