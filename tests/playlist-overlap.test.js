import { topOverlappingPlaylists } from '../server/lib/playlist-overlap.js';

// rows shape matches IndexedPlaylistTrack: { playlistId, playlistTitle, trackId }
const rows = [
  { playlistId: 1, playlistTitle: 'A', trackId: 10 },
  { playlistId: 1, playlistTitle: 'A', trackId: 11 },
  { playlistId: 1, playlistTitle: 'A', trackId: 12 },
  { playlistId: 2, playlistTitle: 'B', trackId: 11 },
  { playlistId: 2, playlistTitle: 'B', trackId: 12 },
  { playlistId: 3, playlistTitle: 'C', trackId: 99 },
];

describe('topOverlappingPlaylists', () => {
  test('ranks pairs by shared track count with Jaccard percent', () => {
    const result = topOverlappingPlaylists(rows, { limit: 5 });
    expect(result[0]).toEqual({
      playlistA: { id: 1, title: 'A' },
      playlistB: { id: 2, title: 'B' },
      sharedTracks: 2,
      overlapPercent: 67, // 2 shared / 3 union
    });
  });

  test('omits pairs with zero overlap', () => {
    const result = topOverlappingPlaylists(rows, { limit: 5 });
    expect(result.some((p) => p.playlistB.id === 3 || p.playlistA.id === 3)).toBe(false);
  });

  test('respects the limit', () => {
    expect(topOverlappingPlaylists(rows, { limit: 1 })).toHaveLength(1);
  });
});
