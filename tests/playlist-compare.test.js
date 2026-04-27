import { comparePlaylists } from '../server/lib/playlist-compare.js';

describe('playlist comparison', () => {
  test('reports overlap and tracks unique to each playlist', () => {
    const result = comparePlaylists(
      { id: 1, title: 'A', tracks: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      { id: 2, title: 'B', tracks: [{ id: 2 }, { id: 3 }, { id: 4 }] }
    );

    expect(result.summary).toEqual({
      playlistA: { id: 1, title: 'A', trackCount: 3 },
      playlistB: { id: 2, title: 'B', trackCount: 3 },
      overlapCount: 2,
      uniqueToACount: 1,
      uniqueToBCount: 1,
      overlapPercent: 50,
    });
    expect(result.overlap.map((track) => track.id)).toEqual([2, 3]);
    expect(result.uniqueToA.map((track) => track.id)).toEqual([1]);
    expect(result.uniqueToB.map((track) => track.id)).toEqual([4]);
  });

  test('deduplicates repeated tracks before calculating overlap', () => {
    const result = comparePlaylists(
      { id: 1, title: 'A', tracks: [{ id: 1 }, { id: 1 }, { id: 2 }] },
      { id: 2, title: 'B', tracks: [{ id: 1 }, { id: 3 }] }
    );

    expect(result.summary.overlapCount).toBe(1);
    expect(result.summary.overlapPercent).toBe(33);
    expect(result.overlap.map((track) => track.id)).toEqual([1]);
    expect(result.uniqueToA.map((track) => track.id)).toEqual([2]);
  });
});
