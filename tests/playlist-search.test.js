import {
  parseKeywords,
  matchTrack,
  searchTracksInPlaylists,
  removeTrackIds,
  appendTrackIds,
} from '../server/lib/playlist-search.js';

describe('parseKeywords', () => {
  test('splits on commas, trims, lowercases and dedupes', () => {
    expect(parseKeywords(' Remix, BOOTLEG ,remix, ')).toEqual(['remix', 'bootleg']);
  });

  test('keeps a multi-word query as one phrase', () => {
    expect(parseKeywords('live set')).toEqual(['live set']);
  });

  test('returns nothing for empty or non-string input', () => {
    expect(parseKeywords('')).toEqual([]);
    expect(parseKeywords('   ,  , ')).toEqual([]);
    expect(parseKeywords(null)).toEqual([]);
    expect(parseKeywords(42)).toEqual([]);
  });
});

describe('matchTrack', () => {
  const track = { title: 'Sunset Bootleg', user: { username: 'DJ Remixer' } };

  test('matches the title case-insensitively', () => {
    expect(matchTrack(track, ['bootleg'])).toEqual({ keyword: 'bootleg', matchedIn: 'title' });
  });

  test('matches the artist when the title does not', () => {
    expect(matchTrack(track, ['remixer'])).toEqual({ keyword: 'remixer', matchedIn: 'artist' });
  });

  test('prefers a title hit over an artist hit', () => {
    const both = { title: 'Remix Time', user: { username: 'Remix Lord' } };
    expect(matchTrack(both, ['remix']).matchedIn).toBe('title');
  });

  test('returns null with no keywords or no hit', () => {
    expect(matchTrack(track, [])).toBeNull();
    expect(matchTrack(track, ['techno'])).toBeNull();
    expect(matchTrack(null, ['x'])).toBeNull();
  });

  test('tolerates a missing title or artist', () => {
    expect(matchTrack({ user: { username: 'Nova' } }, ['nova']).matchedIn).toBe('artist');
    expect(matchTrack({ title: 'Nova' }, ['nova']).matchedIn).toBe('title');
  });
});

describe('searchTracksInPlaylists', () => {
  const playlists = [
    {
      id: 1,
      title: 'Warmup',
      tracks: [
        { id: 10, title: 'Intro Bootleg', user: { username: 'A' } },
        { id: 11, title: 'Plain', user: { username: 'B' } },
      ],
    },
    {
      id: 2,
      title: 'Peak',
      tracks: [{ id: 10, title: 'Intro Bootleg', user: { username: 'A' } }],
    },
  ];

  test('reports one match per playlist the track appears in', () => {
    const { matches, stats } = searchTracksInPlaylists(playlists, ['bootleg']);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.playlistId)).toEqual([1, 2]);
    // Same track twice — the caller needs both rows to remove it from both.
    expect(stats.matchCount).toBe(2);
    expect(stats.uniqueTrackCount).toBe(1);
  });

  test('records position, playlist title and why it matched', () => {
    const [first] = searchTracksInPlaylists(playlists, ['bootleg']).matches;
    expect(first).toMatchObject({
      trackId: 10,
      playlistId: 1,
      playlistTitle: 'Warmup',
      position: 0,
      keyword: 'bootleg',
      matchedIn: 'title',
    });
  });

  test('counts every track scanned, not just the hits', () => {
    const { stats } = searchTracksInPlaylists(playlists, ['bootleg']);
    expect(stats.tracksScanned).toBe(3);
    expect(stats.playlistsSearched).toBe(2);
  });

  test('skips tracks with an unusable id', () => {
    const bad = [{ id: 3, title: 'x', tracks: [{ id: null, title: 'Bootleg' }, { id: 0, title: 'Bootleg' }] }];
    expect(searchTracksInPlaylists(bad, ['bootleg']).matches).toHaveLength(0);
  });

  test('handles a playlist with no tracks array and a non-array input', () => {
    expect(searchTracksInPlaylists([{ id: 9, title: 'Empty' }], ['x']).matches).toEqual([]);
    expect(searchTracksInPlaylists(null, ['x']).matches).toEqual([]);
  });
});

describe('removeTrackIds', () => {
  test('drops the listed ids and keeps the surviving order', () => {
    expect(removeTrackIds([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
  });

  test('removes every copy of a duplicated id', () => {
    expect(removeTrackIds([1, 2, 1, 3], [1])).toEqual([2, 3]);
  });

  test('is a no-op when nothing matches', () => {
    expect(removeTrackIds([1, 2], [99])).toEqual([1, 2]);
  });
});

describe('appendTrackIds', () => {
  test('appends new ids and reports duplicates separately', () => {
    const result = appendTrackIds([1, 2], [2, 3], 500);
    expect(result.nextIds).toEqual([1, 2, 3]);
    expect(result.added).toEqual([3]);
    expect(result.alreadyPresent).toEqual([2]);
    expect(result.noRoom).toEqual([]);
  });

  test('stops at the cap and reports what did not fit', () => {
    const result = appendTrackIds([1, 2], [3, 4], 3);
    expect(result.nextIds).toEqual([1, 2, 3]);
    expect(result.added).toEqual([3]);
    expect(result.noRoom).toEqual([4]);
  });

  test('does not double-add an id repeated within the input', () => {
    const result = appendTrackIds([], [7, 7], 500);
    expect(result.nextIds).toEqual([7]);
    expect(result.added).toEqual([7]);
    expect(result.alreadyPresent).toEqual([7]);
  });

  test('adds nothing to an already-full playlist', () => {
    const result = appendTrackIds([1, 2, 3], [4], 3);
    expect(result.nextIds).toEqual([1, 2, 3]);
    expect(result.added).toEqual([]);
    expect(result.noRoom).toEqual([4]);
  });
});
