/**
 * @jest-environment node
 */

import { buildRekordboxIndex } from '../server/lib/rekordbox-match.js';
import { parseRekordboxXml } from '../server/lib/rekordbox-xml.js';
import {
  buildSyncReport,
  comparePlaylistPair,
  compareSourceToLibrary,
  findRekordboxOnly,
  pairPlaylists,
  playlistNameAffinity,
} from '../server/lib/rekordbox-report.js';

function rbTrack(overrides) {
  return {
    rbId: '1',
    title: '',
    artist: '',
    album: '',
    genre: '',
    bpm: null,
    key: '',
    durationMs: null,
    rating: null,
    playCount: null,
    dateAdded: '',
    location: '',
    ...overrides,
  };
}

function scTrack(id, title, uploader, extra = {}) {
  return {
    id,
    title,
    duration: null,
    user: { display_name: uploader, username: uploader },
    permalink_url: `https://soundcloud.com/x/${id}`,
    ...extra,
  };
}

const LIBRARY = {
  tracks: [
    rbTrack({ rbId: '101', title: 'Les Nuits', artist: 'Nightmares On Wax' }),
    rbTrack({ rbId: '102', title: 'Glue', artist: 'Bicep' }),
    rbTrack({ rbId: '103', title: 'Sun & Moon', artist: 'Above & Beyond' }),
  ],
  playlists: [
    { name: 'Warmup', path: 'Warmup', trackIds: ['101', '103'] },
    { name: 'Peak Time', path: 'House/Peak Time', trackIds: ['102'] },
  ],
  meta: { declaredEntries: 3, parsedEntries: 3, product: 'rekordbox', version: '6.7.7' },
};

describe('compareSourceToLibrary', () => {
  const index = buildRekordboxIndex(LIBRARY.tracks);

  test('splits a source into owned and missing', () => {
    const result = compareSourceToLibrary(
      {
        id: 'likes',
        label: 'Likes',
        tracks: [
          scTrack(1, 'Bicep - Glue', 'Label'),
          scTrack(2, 'Brand New Unowned Track', 'Someone'),
        ],
      },
      index
    );

    expect(result.summary.owned).toBe(1);
    expect(result.summary.missing).toBe(1);
    expect(result.summary.total).toBe(2);
    expect(result.missing[0].track.id).toBe(2);
    expect(result.owned[0].rekordbox.rbId).toBe('102');
  });

  test('reports coverage as a percentage', () => {
    const result = compareSourceToLibrary(
      {
        id: 'likes',
        label: 'Likes',
        tracks: [
          scTrack(1, 'Bicep - Glue', 'Label'),
          scTrack(2, 'Nightmares On Wax - Les Nuits', 'Label'),
          scTrack(3, 'Missing One', 'Someone'),
          scTrack(4, 'Missing Two', 'Someone'),
        ],
      },
      index
    );

    expect(result.summary.coveragePercent).toBe(50);
  });

  test('carries download affordances through to the missing list', () => {
    const result = compareSourceToLibrary(
      {
        id: 'likes',
        label: 'Likes',
        tracks: [
          scTrack(9, 'Totally Absent Record', 'Someone', {
            downloadable: true,
            purchase_url: 'https://example.com/buy',
          }),
        ],
      },
      index
    );

    expect(result.missing[0].track.downloadable).toBe(true);
    expect(result.missing[0].track.purchaseUrl).toBe('https://example.com/buy');
  });

  test('handles an empty source', () => {
    const result = compareSourceToLibrary({ id: 'likes', label: 'Likes', tracks: [] }, index);
    expect(result.summary).toMatchObject({ total: 0, owned: 0, missing: 0, coveragePercent: 0 });
  });
});

describe('findRekordboxOnly', () => {
  const index = buildRekordboxIndex(LIBRARY.tracks);

  test('lists collection tracks that no source accounted for', () => {
    const comparison = compareSourceToLibrary(
      { id: 'likes', label: 'Likes', tracks: [scTrack(1, 'Bicep - Glue', 'Label')] },
      index
    );

    const only = findRekordboxOnly(index, [comparison]);
    expect(only.map((track) => track.rbId).sort()).toEqual(['101', '103']);
  });

  test('a fuzzy match is enough to keep a track off the list', () => {
    // "Les Nuits" uploaded by an unrelated channel matches on title alone,
    // which is review-grade evidence — but still evidence.
    const comparison = compareSourceToLibrary(
      { id: 'likes', label: 'Likes', tracks: [scTrack(1, 'Les Nuits', 'Some Radio Show')] },
      index
    );

    expect(comparison.summary.needsReview).toBe(1);
    expect(findRekordboxOnly(index, [comparison]).map((t) => t.rbId)).not.toContain('101');
  });

  test('returns everything when no sources are given', () => {
    expect(findRekordboxOnly(index, [])).toHaveLength(3);
  });
});

describe('playlistNameAffinity', () => {
  test('scores an identical name at 1', () => {
    expect(playlistNameAffinity('Peak Time', 'Peak Time')).toBe(1);
  });

  test('scores partial overlap between 0 and 1', () => {
    const affinity = playlistNameAffinity('Peak Time Techno', 'Peak Time');
    expect(affinity).toBeGreaterThan(0);
    expect(affinity).toBeLessThan(1);
  });

  test('scores unrelated names at 0', () => {
    expect(playlistNameAffinity('Warmup', 'Peak Time')).toBe(0);
  });
});

describe('pairPlaylists', () => {
  test('pairs playlists by name and reports the leftovers', () => {
    const result = pairPlaylists(
      [
        { id: 1, title: 'Warmup' },
        { id: 2, title: 'Peak Time' },
        { id: 3, title: 'Ambient Sundays' },
      ],
      LIBRARY.playlists
    );

    expect(result.pairs).toHaveLength(2);
    expect(result.unpairedSoundcloud.map((p) => p.title)).toEqual(['Ambient Sundays']);
    expect(result.unpairedRekordbox).toHaveLength(0);

    const warmup = result.pairs.find((pair) => pair.soundcloud.title === 'Warmup');
    expect(warmup.rekordbox.name).toBe('Warmup');
    expect(warmup.affinity).toBe(1);
  });

  test('never assigns one rekordbox playlist to two SoundCloud playlists', () => {
    const result = pairPlaylists(
      [
        { id: 1, title: 'Peak Time' },
        { id: 2, title: 'Peak Time' },
      ],
      [{ name: 'Peak Time', path: 'Peak Time', trackIds: [] }]
    );

    expect(result.pairs).toHaveLength(1);
    expect(result.unpairedSoundcloud).toHaveLength(1);
  });

  test('matches a rekordbox playlist nested in folders on its leaf name', () => {
    const result = pairPlaylists([{ id: 1, title: 'Peak Time' }], LIBRARY.playlists);
    expect(result.pairs[0].rekordbox.path).toBe('House/Peak Time');
  });
});

describe('comparePlaylistPair', () => {
  const index = buildRekordboxIndex(LIBRARY.tracks);

  test('separates "not in the collection" from "not in this crate"', () => {
    const result = comparePlaylistPair(
      {
        id: 1,
        label: 'Warmup',
        tracks: [
          // In the collection and in the rekordbox playlist.
          scTrack(1, 'Nightmares On Wax - Les Nuits', 'Label'),
          // In the collection, but filed under a different crate.
          scTrack(2, 'Bicep - Glue', 'Label'),
          // Not in the collection at all.
          scTrack(3, 'Nowhere To Be Found', 'Someone'),
        ],
      },
      LIBRARY.playlists[0],
      index
    );

    expect(result.summary.inBoth).toBe(1);
    expect(result.summary.inLibraryNotPlaylist).toBe(1);
    expect(result.summary.missingFromLibrary).toBe(1);
    expect(result.inLibraryNotPlaylist[0].track.id).toBe(2);
    expect(result.missingFromLibrary[0].track.id).toBe(3);
  });

  test('reports rekordbox playlist tracks the SoundCloud side lacks', () => {
    const result = comparePlaylistPair(
      { id: 1, label: 'Warmup', tracks: [scTrack(1, 'Nightmares On Wax - Les Nuits', 'Label')] },
      LIBRARY.playlists[0],
      index
    );

    expect(result.summary.onlyInRekordbox).toBe(1);
    expect(result.onlyInRekordbox[0].rbId).toBe('103');
  });

  test('reports a fully synced pair as clean', () => {
    const result = comparePlaylistPair(
      { id: 1, label: 'Peak Time', tracks: [scTrack(1, 'Bicep - Glue', 'Label')] },
      LIBRARY.playlists[1],
      index
    );

    expect(result.summary).toMatchObject({
      inBoth: 1,
      missingFromLibrary: 0,
      inLibraryNotPlaylist: 0,
      onlyInRekordbox: 0,
    });
  });
});

describe('buildSyncReport', () => {
  test('assembles library stats, comparisons, drift, and totals', () => {
    const report = buildSyncReport({
      sources: [
        {
          id: 'likes',
          label: 'Likes',
          tracks: [scTrack(1, 'Bicep - Glue', 'Label'), scTrack(2, 'Unowned Thing', 'Someone')],
        },
      ],
      library: LIBRARY,
      playlistPairs: [
        {
          source: { id: 1, label: 'Warmup', tracks: [scTrack(3, 'Nightmares On Wax - Les Nuits', 'L')] },
          rbPlaylist: LIBRARY.playlists[0],
        },
      ],
    });

    expect(report.library).toMatchObject({ trackCount: 3, playlistCount: 2, product: 'rekordbox' });
    expect(report.comparisons).toHaveLength(1);
    expect(report.drift).toHaveLength(1);
    expect(report.drift[0].summary.onlyInRekordbox).toBe(1);
    expect(report.totals.soundcloudTracks).toBe(2);
    expect(report.totals.uniqueMissing).toBe(1);
  });

  test('counts a track missing from two sources only once', () => {
    const missing = scTrack(7, 'Same Missing Track', 'Someone');
    const report = buildSyncReport({
      sources: [
        { id: 'likes', label: 'Likes', tracks: [missing] },
        { id: 'p1', label: 'Playlist One', tracks: [{ ...missing }] },
      ],
      library: LIBRARY,
    });

    expect(report.comparisons[0].summary.missing).toBe(1);
    expect(report.comparisons[1].summary.missing).toBe(1);
    expect(report.totals.uniqueMissing).toBe(1);
  });

  test('handles a library with no playlists', () => {
    const report = buildSyncReport({
      sources: [{ id: 'likes', label: 'Likes', tracks: [scTrack(1, 'Bicep - Glue', 'L')] }],
      library: { ...LIBRARY, playlists: [] },
    });

    expect(report.library.playlistCount).toBe(0);
    expect(report.drift).toEqual([]);
  });
});

describe('end to end, from an exported file', () => {
  // Exercises exactly what the browser does: raw XML text in, report out —
  // with the messy title formats real SoundCloud libraries are full of.
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.7.7"/>
  <COLLECTION Entries="4">
    <TRACK TrackID="1" Name="Les Nuits" Artist="Nightmares On Wax" TotalTime="380"/>
    <TRACK TrackID="2" Name="Glue" Artist="Bicep" TotalTime="331"/>
    <TRACK TrackID="3" Name="Sun &amp; Moon" Artist="Above &amp; Beyond" TotalTime="240"/>
    <TRACK TrackID="4" Name="Jóga" Artist="Björk" TotalTime="300"/>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Name="Warmup" Type="1" KeyType="0" Entries="2">
        <TRACK Key="1"/>
        <TRACK Key="4"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

  const library = parseRekordboxXml(XML);

  test('resolves real-world SoundCloud title formats against the collection', () => {
    const report = buildSyncReport({
      sources: [
        {
          id: 'likes',
          label: 'Likes',
          tracks: [
            // Promo prefix, artist in the title, catalogue number suffix.
            scTrack(1, '[PREMIERE] Nightmares On Wax - Les Nuits [WARP001]', 'Warp Records', {
              duration: 380000,
            }),
            // Ampersand spelled out on one side.
            scTrack(2, 'Above and Beyond - Sun and Moon', 'Anjunabeats'),
            // Accents dropped by the uploader.
            scTrack(3, 'Bjork - Joga', 'Some Radio Show'),
            // Genuinely absent.
            scTrack(4, 'Track I Have Never Owned', 'Nobody'),
          ],
        },
      ],
      library,
    });

    expect(report.library.trackCount).toBe(4);
    expect(report.comparisons[0].summary.owned).toBe(3);
    expect(report.totals.uniqueMissing).toBe(1);
    expect(report.comparisons[0].missing[0].track.id).toBe(4);
    // "Glue" was never checked, so it's the only unaccounted-for collection track.
    expect(report.rekordboxOnly.map((track) => track.rbId)).toEqual(['2']);
  });

  test('reports playlist drift against a same-named rekordbox crate', () => {
    const scPlaylist = {
      id: 'p1',
      label: 'Warmup',
      tracks: [
        scTrack(1, 'Nightmares On Wax - Les Nuits', 'Warp'),
        // Owned, but filed in a different crate.
        scTrack(2, 'Bicep - Glue', 'Ninja Tune'),
      ],
    };

    const paired = pairPlaylists([{ id: 'p1', title: 'Warmup' }], library.playlists);
    expect(paired.pairs).toHaveLength(1);

    const report = buildSyncReport({
      sources: [scPlaylist],
      library,
      playlistPairs: [{ source: scPlaylist, rbPlaylist: paired.pairs[0].rekordbox }],
    });

    const [drift] = report.drift;
    expect(drift.summary.inBoth).toBe(1);
    expect(drift.summary.inLibraryNotPlaylist).toBe(1);
    // Björk is in the rekordbox crate but not the SoundCloud playlist.
    expect(drift.summary.onlyInRekordbox).toBe(1);
    expect(drift.onlyInRekordbox[0].rbId).toBe('4');
  });
});
