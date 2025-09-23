import { dedupeTrackIds, mergePlaylistsTrackIds } from '../server/lib/merge-utils.js';

describe('merge utils', () => {
  test('dedupe track ids preserves order', () => {
    const input = [1, 2, 2, 3, 1, 4];
    expect(dedupeTrackIds(input)).toEqual([1, 2, 3, 4]);
  });

  test('merge playlists yields unique ids', () => {
    const a = { tracks: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    const b = { tracks: [{ id: 2 }, { id: 4 }] };
    expect(mergePlaylistsTrackIds([a, b])).toEqual([1, 2, 3, 4]);
  });
});


