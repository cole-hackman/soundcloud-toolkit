import { analyzePlaylistForAudit, summarizeLibraryAudit } from '../server/lib/library-audit.js';

describe('library audit analysis', () => {
  test('summarizes playlist health and download issues', () => {
    const result = analyzePlaylistForAudit({
      id: 1,
      title: 'Test playlist',
      track_count: 4,
      tracks: [
        { id: 10, title: 'A', access: 'playable', downloadable: true, download_url: 'https://api.soundcloud.com/tracks/10/download' },
        { id: 10, title: 'A duplicate', access: 'playable' },
        { id: 11, title: 'B', access: 'blocked' },
        { id: 12, title: 'C', access: 'preview', purchase_url: 'https://artist.example/download' },
      ],
    });

    expect(result.summary).toMatchObject({
      totalTracks: 4,
      duplicateTracks: 1,
      unavailableTracks: 2,
      directDownloads: 1,
      purchaseLinks: 1,
      nearCap: false,
    });
    expect(result.issues.map((issue) => issue.type)).toEqual([
      'duplicate',
      'unavailable',
      'unavailable',
    ]);
  });

  test('marks playlists near the SoundCloud cap', () => {
    const tracks = Array.from({ length: 450 }, (_, index) => ({ id: index + 1, title: `Track ${index + 1}` }));
    const result = analyzePlaylistForAudit({ id: 2, title: 'Large playlist', tracks });

    expect(result.summary.nearCap).toBe(true);
  });

  test('counts unavailable and commerce signals even when a track id is missing', () => {
    const result = analyzePlaylistForAudit({
      id: 3,
      title: 'Partial metadata',
      tracks: [
        { title: 'No ID unavailable', streamable: false, download_url: 'https://api.soundcloud.com/tracks/1/download', purchase_url: 'https://artist.example' },
        { id: 4, title: 'Blocked', blocked_at: '2026-01-01T00:00:00Z' },
      ],
    });

    expect(result.summary.unavailableTracks).toBe(2);
    expect(result.summary.directDownloads).toBe(1);
    expect(result.summary.purchaseLinks).toBe(1);
    expect(result.issues.map((issue) => issue.type)).toEqual(['unavailable', 'unavailable']);
  });

  test('emits duplicate and unavailable issues for the same repeated track', () => {
    const result = analyzePlaylistForAudit({
      id: 4,
      title: 'Duplicate unavailable',
      tracks: [
        { id: 10, title: 'Original' },
        { id: 10, title: 'Duplicate blocked', access: 'blocked' },
      ],
    });

    expect(result.issues.map((issue) => issue.type)).toEqual(['duplicate', 'unavailable']);
  });

  test('keeps trackCount and totalTracks consistent when only track_count is available', () => {
    const result = analyzePlaylistForAudit({ id: 5, title: 'Summary only', track_count: 12, tracks: [] });

    expect(result.trackCount).toBe(12);
    expect(result.summary.totalTracks).toBe(12);
  });

  test('aggregates summary totals across playlists', () => {
    const result = summarizeLibraryAudit([
      { id: 1, title: 'A', tracks: [{ id: 1 }, { id: 1 }, { id: 2, streamable: false }] },
      { id: 2, title: 'B', tracks: [{ id: 3, downloadable: true }, { id: 4, purchase_url: 'https://artist.example' }] },
    ]);

    expect(result.summary).toMatchObject({
      playlists: 2,
      tracks: 5,
      duplicates: 1,
      unavailable: 1,
      directDownloads: 1,
      purchaseLinks: 1,
    });
  });
});
