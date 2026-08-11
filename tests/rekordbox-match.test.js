/**
 * @jest-environment node
 */

import {
  buildFingerprint,
  buildRekordboxIndex,
  extractFeaturing,
  extractVersion,
  fieldSimilarity,
  matchTracks,
  normalizeText,
  scorePair,
  soundcloudCandidates,
  splitArtistTitle,
  stripPromoNoise,
} from '../server/lib/rekordbox-match.js';

/**
 * @param {Partial<import('../server/lib/rekordbox-xml.js').RekordboxTrack>} overrides
 */
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

/**
 * @param {string} title
 * @param {string} uploader
 * @param {number|null} duration
 */
function scTrack(title, uploader, duration = null) {
  return {
    id: 1,
    title,
    duration,
    user: { display_name: uploader, username: uploader },
    permalink_url: 'https://soundcloud.com/x/y',
  };
}

describe('normalizeText', () => {
  test('folds accents and case', () => {
    expect(normalizeText('Björk – Jóga')).toBe('bjork joga');
  });

  test('expands ampersands so "&" and "and" agree', () => {
    expect(normalizeText('Above & Beyond')).toBe('above and beyond');
    expect(normalizeText('Above and Beyond')).toBe('above and beyond');
  });

  test('treats punctuation as a separator, not a deletion', () => {
    expect(normalizeText('re:work')).toBe('re work');
  });

  test('is stable on empty input', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(null)).toBe('');
  });
});

describe('stripPromoNoise', () => {
  test.each([
    ['[PREMIERE] Nightmares On Wax - Les Nuits', 'Nightmares On Wax - Les Nuits'],
    ['FREE DOWNLOAD | Artist - Track', 'Artist - Track'],
    ['PREMIERE: Artist - Track', 'Artist - Track'],
    ['[OUT NOW] Artist - Track', 'Artist - Track'],
    ['[PREMIERE] [FREE DL] Artist - Track', 'Artist - Track'],
  ])('strips %s', (input, expected) => {
    expect(stripPromoNoise(input)).toBe(expected);
  });

  test('leaves a clean title untouched', () => {
    expect(stripPromoNoise('Nightmares On Wax - Les Nuits')).toBe('Nightmares On Wax - Les Nuits');
  });
});

describe('extractVersion', () => {
  test('pulls a bracketed remix out of the title', () => {
    expect(extractVersion('Les Nuits (Ame Remix)')).toEqual({
      title: 'Les Nuits',
      version: 'Ame Remix',
    });
  });

  test('pulls a dash-suffixed version, the Beatport tagging convention', () => {
    expect(extractVersion('Les Nuits - Extended Mix')).toEqual({
      title: 'Les Nuits',
      version: 'Extended Mix',
    });
  });

  test('drops catalogue numbers and label brackets as noise', () => {
    expect(extractVersion('Les Nuits [WARP001]')).toEqual({ title: 'Les Nuits', version: '' });
  });

  test('keeps version while dropping noise in the same title', () => {
    expect(extractVersion('Les Nuits (Ame Remix) [WARP001]')).toEqual({
      title: 'Les Nuits',
      version: 'Ame Remix',
    });
  });

  test('does not mistake a hyphenated title for a version', () => {
    expect(extractVersion('Love - Hate')).toEqual({ title: 'Love - Hate', version: '' });
  });
});

describe('extractFeaturing', () => {
  test('separates featured artists from the title', () => {
    expect(extractFeaturing('Track Name feat. Someone')).toEqual({
      title: 'Track Name',
      feat: 'Someone',
    });
    expect(extractFeaturing('Track Name (ft. Someone)')).toEqual({
      title: 'Track Name',
      feat: 'Someone',
    });
  });

  test('leaves titles without a feature intact', () => {
    expect(extractFeaturing('Track Name')).toEqual({ title: 'Track Name', feat: '' });
  });
});

describe('splitArtistTitle', () => {
  test('splits on the first dash', () => {
    expect(splitArtistTitle('Nightmares On Wax - Les Nuits')).toEqual({
      artist: 'Nightmares On Wax',
      title: 'Les Nuits',
    });
  });

  test('returns null when there is no separator', () => {
    expect(splitArtistTitle('Les Nuits')).toBeNull();
  });
});

describe('buildFingerprint', () => {
  test('treats "Original Mix" as no version at all', () => {
    expect(buildFingerprint('Bicep', 'Glue (Original Mix)').version).toBe('');
    expect(buildFingerprint('Bicep', 'Glue').version).toBe('');
  });

  test('keeps a real remix as a distinguishing version', () => {
    expect(buildFingerprint('Bicep', 'Glue (Ame Remix)').version).toBe('ame remix');
  });
});

describe('scorePair', () => {
  test('an identical pair is exact', () => {
    const a = buildFingerprint('Bicep', 'Glue');
    const b = buildFingerprint('Bicep', 'Glue');
    expect(scorePair(a, b)).toEqual({ tier: 'exact', score: 1 });
  });

  test('refuses to match a remix against the original', () => {
    const original = buildFingerprint('Bicep', 'Glue');
    const remix = buildFingerprint('Bicep', 'Glue (Ame Remix)');
    expect(scorePair(original, remix).tier).toBeNull();
  });

  test('refuses to match two different remixes of one track', () => {
    const ame = buildFingerprint('Bicep', 'Glue (Ame Remix)');
    const other = buildFingerprint('Bicep', 'Glue (Four Tet Remix)');
    expect(scorePair(ame, other).tier).toBeNull();
  });

  test('tolerates a missing artist on one side', () => {
    const withArtist = buildFingerprint('Bicep', 'Glue');
    const withoutArtist = buildFingerprint('', 'Glue');
    expect(scorePair(withoutArtist, withArtist).tier).toBe('strong');
  });

  test('does not match unrelated tracks', () => {
    const a = buildFingerprint('Bicep', 'Glue');
    const b = buildFingerprint('Nightmares On Wax', 'Les Nuits');
    expect(scorePair(a, b).tier).toBeNull();
  });
});

describe('soundcloudCandidates', () => {
  test('offers both the uploader reading and the artist-in-title reading', () => {
    const candidates = soundcloudCandidates(
      scTrack('[PREMIERE] Nightmares On Wax - Les Nuits [WARP001]', 'Warp Records')
    );

    expect(candidates.some((c) => c.artist === 'warp records')).toBe(true);
    expect(
      candidates.some((c) => c.artist === 'nightmares on wax' && c.title === 'les nuits')
    ).toBe(true);
  });
});

describe('fieldSimilarity', () => {
  test('scores identical strings at 1', () => {
    expect(fieldSimilarity('glue', 'glue')).toBe(1);
  });

  test('scores unrelated strings low', () => {
    expect(fieldSimilarity('glue', 'les nuits')).toBeLessThan(0.4);
  });

  test('survives word reordering', () => {
    expect(fieldSimilarity('bicep glue', 'glue bicep')).toBeGreaterThan(0.8);
  });
});

describe('matchTracks', () => {
  const library = [
    rbTrack({ rbId: '101', title: 'Les Nuits', artist: 'Nightmares On Wax', durationMs: 380000 }),
    rbTrack({ rbId: '102', title: 'Glue', artist: 'Bicep', durationMs: 331000 }),
    rbTrack({ rbId: '103', title: 'Sun & Moon', artist: 'Above & Beyond', durationMs: 240000 }),
    rbTrack({ rbId: '104', title: 'Glue (Ame Remix)', artist: 'Bicep', durationMs: 400000 }),
  ];

  test('matches a clean title directly', () => {
    const [match] = matchTracks([scTrack('Glue', 'Bicep', 331000)], library);
    expect(match.rbTrack.rbId).toBe('102');
    expect(match.tier).toBe('exact');
  });

  test('finds the artist buried in a promo-decorated SoundCloud title', () => {
    const [match] = matchTracks(
      [scTrack('[PREMIERE] Nightmares On Wax - Les Nuits [WARP001]', 'Warp Records', 380000)],
      library
    );
    expect(match.rbTrack.rbId).toBe('101');
    expect(['exact', 'strong']).toContain(match.tier);
  });

  test('routes the remix to the remix, not the original', () => {
    const [match] = matchTracks([scTrack('Bicep - Glue (Ame Remix)', 'Label', 400000)], library);
    expect(match.rbTrack.rbId).toBe('104');
  });

  test('routes the original to the original, not the remix', () => {
    const [match] = matchTracks([scTrack('Bicep - Glue', 'Label', 331000)], library);
    expect(match.rbTrack.rbId).toBe('102');
  });

  test('reconciles "&" with "and"', () => {
    const [match] = matchTracks([scTrack('Above and Beyond - Sun and Moon', 'Anjuna')], library);
    expect(match.rbTrack.rbId).toBe('103');
  });

  test('reports no match for a track absent from the collection', () => {
    const [match] = matchTracks([scTrack('Some Unrelated Bootleg', 'Nobody')], library);
    expect(match.rbTrack).toBeNull();
    expect(match.tier).toBeNull();
  });

  test('rejects a text match whose runtime disagrees badly', () => {
    // A 30-second teaser upload should not count as owning the 5:31 track.
    const [match] = matchTracks([scTrack('Bicep - Glue', 'Label', 30000)], [library[1]]);
    expect(match.tier).toBe('exact');
    expect(match.durationDeltaMs).toBeGreaterThan(20000);
  });

  test('honours a minimum tier', () => {
    const loose = matchTracks([scTrack('Glu', 'Bicep')], library, { minTier: 'fuzzy' });
    const strict = matchTracks([scTrack('Glu', 'Bicep')], library, { minTier: 'exact' });
    expect(strict[0].tier).not.toBe('fuzzy');
    expect(loose[0].score).toBeGreaterThanOrEqual(strict[0].score);
  });

  test('returns one result per input, in order', () => {
    const results = matchTracks(
      [scTrack('Glue', 'Bicep'), scTrack('Nothing At All', 'Nobody'), scTrack('Les Nuits', 'NOW')],
      library
    );
    expect(results).toHaveLength(3);
    expect(results[0].rbTrack.rbId).toBe('102');
    expect(results[1].rbTrack).toBeNull();
    expect(results[2].rbTrack.rbId).toBe('101');
  });

  test('a prebuilt index gives the same answer as an implicit one', () => {
    const index = buildRekordboxIndex(library);
    const tracks = [scTrack('Glue', 'Bicep'), scTrack('Les Nuits', 'NOW')];
    expect(matchTracks(tracks, library, { index })).toEqual(matchTracks(tracks, library));
  });

  test('scales to a large collection without quadratic blowup', () => {
    const big = Array.from({ length: 5000 }, (_, i) =>
      rbTrack({ rbId: String(i), title: `Track Number ${i}`, artist: `Artist ${i % 250}` })
    );
    const queries = Array.from({ length: 300 }, (_, i) =>
      scTrack(`Artist ${i % 250} - Track Number ${i}`, 'Label')
    );

    const started = Date.now();
    const results = matchTracks(queries, big);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(results.filter((r) => r.rbTrack !== null).length).toBeGreaterThan(250);
  });
});
