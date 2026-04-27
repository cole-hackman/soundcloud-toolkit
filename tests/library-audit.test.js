import { analyzePlaylistForAudit } from '../server/lib/library-audit.js';

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
});
