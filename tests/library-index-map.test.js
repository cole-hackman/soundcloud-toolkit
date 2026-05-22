import { mapLikeToRow, mapPlaylistTracksToRows } from '../server/lib/library-index-map.js';

const like = {
  id: 555,
  title: 'Acid Trip',
  genre: 'Tech House',
  tag_list: 'dark warehouse',
  duration: 360000,
  created_at: '2024-01-02T03:04:05Z',
  user: { id: 99, username: 'riordan' },
};

describe('mapLikeToRow', () => {
  test('extracts indexed fields and normalizes genre', () => {
    expect(mapLikeToRow('user1', like)).toEqual({
      userId: 'user1',
      trackId: 555,
      title: 'Acid Trip',
      artistName: 'riordan',
      artistId: 99,
      genre: 'Tech House',
      genreNormalized: 'tech house',
      tagList: 'dark warehouse',
      durationMs: 360000,
      likedAt: new Date('2024-01-02T03:04:05Z'),
    });
  });

  test('handles like objects wrapped under a track property', () => {
    const wrapped = { track: like };
    expect(mapLikeToRow('user1', wrapped).trackId).toBe(555);
  });

  test('returns null when there is no track id', () => {
    expect(mapLikeToRow('user1', { title: 'no id' })).toBeNull();
  });
});

describe('mapPlaylistTracksToRows', () => {
  test('produces one row per track with playlist metadata', () => {
    const playlist = { id: 7, title: 'Mix', tracks: [{ id: 1 }, { id: 2 }, { id: 1 }] };
    const rows = mapPlaylistTracksToRows('user1', playlist);
    expect(rows).toEqual([
      { userId: 'user1', playlistId: 7, playlistTitle: 'Mix', trackId: 1 },
      { userId: 'user1', playlistId: 7, playlistTitle: 'Mix', trackId: 2 },
    ]);
  });
});
