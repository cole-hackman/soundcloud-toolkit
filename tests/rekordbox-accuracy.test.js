/**
 * @jest-environment node
 *
 * Accuracy benchmark for the SoundCloud↔rekordbox matcher.
 *
 * READ THIS BEFORE TRUSTING THE NUMBERS. The SoundCloud side of this corpus is
 * synthetic: the distortions below are a model of how SoundCloud titles get
 * mangled, written by the same hand as the matcher. So this measures whether
 * the matcher handles the failure modes we *anticipated*, and guards against
 * regressions in them. It cannot measure the failure modes we didn't think of.
 * Only a real library can do that.
 *
 * What it is good for: a floor, and an alarm when a threshold change quietly
 * trades away precision.
 *
 * The metric that matters most is `falseOwned` — a track reported as "you own
 * this" that maps to the wrong record, or to nothing. That is the failure the
 * user cannot see and will act on. A miss, by contrast, is visible and merely
 * annoying, which is why the tiering is deliberately biased toward it.
 */

import { buildRekordboxIndex, matchTracks } from '../server/lib/rekordbox-match.js';

function rb(rbId, artist, title, durationMs = 300000) {
  return {
    rbId,
    title,
    artist,
    album: '',
    genre: '',
    bpm: null,
    key: '',
    durationMs,
    rating: null,
    playCount: null,
    dateAdded: '',
    location: '',
  };
}

function sc(title, uploader, durationMs = 300000) {
  return {
    id: 0,
    title,
    duration: durationMs,
    user: { display_name: uploader, username: uploader },
  };
}

/** A rekordbox collection of the shape a house/techno DJ would actually have. */
const COLLECTION = [
  rb('1', 'Nightmares On Wax', 'Les Nuits', 380000),
  rb('2', 'Bicep', 'Glue', 331000),
  rb('3', 'Above & Beyond', 'Sun & Moon', 240000),
  rb('4', 'Björk', 'Jóga', 300000),
  rb('5', 'Floating Points', 'Silhouettes', 420000),
  rb('6', 'Four Tet', 'Two Thousand and Seventeen', 290000),
  rb('7', 'Caribou', 'Odessa', 372000),
  rb('8', 'Jamie xx', 'Gosh', 285000),
  rb('9', 'Moderat', 'A New Error', 402000),
  rb('10', 'Bonobo', 'Kerala', 234000),
  rb('11', 'Kiasmos', 'Blurred', 367000),
  rb('12', 'Rival Consoles', 'Recovery', 310000),
  rb('13', 'Jon Hopkins', 'Emerald Rush', 342000),
  rb('14', 'Overmono', 'So U Kno', 295000),
  rb('15', 'Fred again..', 'Delilah', 268000),
  // A remix and its original both present — the classic trap.
  rb('16', 'Bicep', 'Opal (Four Tet Remix)', 431000),
  rb('17', 'Bicep', 'Opal', 355000),
  // Version variants tagged the Beatport way.
  rb('18', 'Lane 8', 'Brightest Lights - Extended Mix', 421000),
  rb('19', 'Ben Böhmer', 'Breathing', 389000),
  rb('20', 'Yotto', 'Nova', 400000),
];

/**
 * Each case declares what the matcher *should* conclude.
 * `expect` is the rbId it should land on, or null for "not in the collection".
 */
const CASES = [
  // ── Clean, artist in the uploader field ──────────────────────────────────
  { sc: sc('Les Nuits', 'Nightmares On Wax', 380000), expect: '1', kind: 'clean' },
  { sc: sc('Glue', 'Bicep', 331000), expect: '2', kind: 'clean' },
  { sc: sc('Silhouettes', 'Floating Points', 420000), expect: '5', kind: 'clean' },

  // ── Artist inside the title, uploader is a label ─────────────────────────
  { sc: sc('Bicep - Glue', 'Ninja Tune', 331000), expect: '2', kind: 'label-upload' },
  { sc: sc('Caribou - Odessa', 'Merge Records', 372000), expect: '7', kind: 'label-upload' },
  { sc: sc('Bonobo - Kerala', 'Ninja Tune', 234000), expect: '10', kind: 'label-upload' },
  { sc: sc('Moderat - A New Error', 'Monkeytown', 402000), expect: '9', kind: 'label-upload' },

  // ── Promo decoration ─────────────────────────────────────────────────────
  { sc: sc('[PREMIERE] Kiasmos - Blurred', 'Some Premiere Channel', 367000), expect: '11', kind: 'promo' },
  { sc: sc('PREMIERE: Rival Consoles - Recovery', 'Mixmag', 310000), expect: '12', kind: 'promo' },
  { sc: sc('FREE DOWNLOAD | Jamie xx - Gosh', 'Free DL Hub', 285000), expect: '8', kind: 'promo' },
  { sc: sc('[OUT NOW] Jon Hopkins - Emerald Rush', 'Domino', 342000), expect: '13', kind: 'promo' },
  { sc: sc('Overmono - So U Kno [XL001]', 'XL Recordings', 295000), expect: '14', kind: 'catalogue' },
  { sc: sc('[PREMIERE] Yotto - Nova [ANJ456]', 'Anjunadeep', 400000), expect: '20', kind: 'promo+catalogue' },

  // ── Character-level noise ────────────────────────────────────────────────
  { sc: sc('Above and Beyond - Sun and Moon', 'Anjunabeats', 240000), expect: '3', kind: 'ampersand' },
  { sc: sc('Bjork - Joga', 'One Little Indian', 300000), expect: '4', kind: 'accents' },
  { sc: sc('Ben Bohmer - Breathing', 'Anjunadeep', 389000), expect: '19', kind: 'accents' },
  { sc: sc('FOUR TET - TWO THOUSAND AND SEVENTEEN', 'Text Records', 290000), expect: '6', kind: 'caps' },
  { sc: sc('Fred again.. - Delilah', 'Atlantic', 268000), expect: '15', kind: 'punctuation' },

  // ── Version handling ─────────────────────────────────────────────────────
  { sc: sc('Bicep - Opal (Four Tet Remix)', 'Ninja Tune', 431000), expect: '16', kind: 'remix→remix' },
  { sc: sc('Bicep - Opal', 'Ninja Tune', 355000), expect: '17', kind: 'original→original' },
  { sc: sc('Bicep - Opal (Original Mix)', 'Ninja Tune', 355000), expect: '17', kind: 'original-mix-noise' },
  { sc: sc('Lane 8 - Brightest Lights (Extended Mix)', 'This Never Happened', 421000), expect: '18', kind: 'version-format' },

  // ── Genuinely absent from the collection ─────────────────────────────────
  { sc: sc('Some Artist - A Track I Do Not Own', 'Some Label', 300000), expect: null, kind: 'absent' },
  { sc: sc('[PREMIERE] Unknown Producer - Untitled Jam [XYZ999]', 'Promo', 300000), expect: null, kind: 'absent' },
  { sc: sc('Totally Different Song', 'Nobody At All', 300000), expect: null, kind: 'absent' },

  // ── Hard negatives: must NOT be reported as owned ────────────────────────
  {
    sc: sc('Bicep - Opal (Chris Lake Remix)', 'Ninja Tune', 390000),
    expect: null,
    kind: 'unowned-remix',
    note: 'A remix we do not have. Matching it to the original or the Four Tet mix would be wrong.',
  },
  {
    sc: sc('Bonobo - Kerala (Sofi Tukker Remix)', 'Ninja Tune', 250000),
    expect: null,
    kind: 'unowned-remix',
  },
];

describe('matcher accuracy on a labeled corpus', () => {
  const index = buildRekordboxIndex(COLLECTION);
  const results = matchTracks(
    CASES.map((testCase) => testCase.sc),
    COLLECTION,
    { index }
  );

  const OWNED_TIERS = new Set(['exact', 'strong']);

  const metrics = {
    truePositive: 0, // owned, correct record
    falseOwned: 0, // owned, but wrong record or shouldn't have matched
    missed: 0, // should have matched, reported as missing
    correctReject: 0, // correctly reported as not in the collection
    review: 0, // landed in the review bucket
    reviewCorrect: 0,
  };

  /** @type {string[]} */
  const failures = [];

  results.forEach((result, position) => {
    const testCase = CASES[position];
    const claimed = result.rbTrack?.rbId ?? null;
    const isOwned = result.tier !== null && OWNED_TIERS.has(result.tier);
    const isReview = result.tier === 'fuzzy';

    if (isReview) {
      metrics.review += 1;
      if (claimed === testCase.expect) metrics.reviewCorrect += 1;
      return;
    }

    if (isOwned) {
      if (claimed === testCase.expect) {
        metrics.truePositive += 1;
      } else {
        metrics.falseOwned += 1;
        failures.push(
          `FALSE OWNED  "${testCase.sc.title}" (${testCase.kind}) → rb:${claimed}, expected rb:${testCase.expect}`
        );
      }
      return;
    }

    if (testCase.expect === null) {
      metrics.correctReject += 1;
    } else {
      metrics.missed += 1;
      failures.push(`MISSED       "${testCase.sc.title}" (${testCase.kind}) → expected rb:${testCase.expect}`);
    }
  });

  const shouldMatch = CASES.filter((testCase) => testCase.expect !== null).length;
  const shouldNotMatch = CASES.length - shouldMatch;
  const recall = metrics.truePositive / shouldMatch;
  const precision = metrics.truePositive / (metrics.truePositive + metrics.falseOwned || 1);

  test('reports its own scorecard', () => {
    const lines = [
      '',
      '  ── matcher scorecard ────────────────────────────────',
      `  corpus                 ${CASES.length} cases (${shouldMatch} owned, ${shouldNotMatch} not)`,
      `  correct matches        ${metrics.truePositive}`,
      `  false "you own this"   ${metrics.falseOwned}`,
      `  missed (owned→absent)  ${metrics.missed}`,
      `  correctly rejected     ${metrics.correctReject}/${shouldNotMatch}`,
      `  sent to review         ${metrics.review} (${metrics.reviewCorrect} of them correct)`,
      `  recall                 ${(recall * 100).toFixed(1)}%`,
      `  precision              ${(precision * 100).toFixed(1)}%`,
      '  ─────────────────────────────────────────────────────',
      ...failures.map((line) => `  ${line}`),
      '',
    ];
    console.log(lines.join('\n'));
    expect(CASES.length).toBeGreaterThan(0);
  });

  test('never claims ownership of the wrong record', () => {
    expect(failures.filter((line) => line.startsWith('FALSE OWNED'))).toEqual([]);
    expect(metrics.falseOwned).toBe(0);
  });

  test('does not match a remix it does not have to something it does', () => {
    const remixCases = CASES.map((testCase, position) => ({ testCase, result: results[position] })).filter(
      ({ testCase }) => testCase.kind === 'unowned-remix'
    );

    for (const { testCase, result } of remixCases) {
      const isOwned = result.tier !== null && OWNED_TIERS.has(result.tier);
      expect({ title: testCase.sc.title, owned: isOwned }).toEqual({
        title: testCase.sc.title,
        owned: false,
      });
    }
  });

  test('finds at least 90% of the tracks that are genuinely present', () => {
    expect(recall).toBeGreaterThanOrEqual(0.9);
  });

  test('keeps the review bucket small enough to be worth triaging', () => {
    expect(metrics.review / CASES.length).toBeLessThan(0.2);
  });
});

/**
 * A deliberately hostile corpus, written to probe cases the matcher was *not*
 * designed around. These are the situations a real library actually produces
 * and where the honest expectation is partial failure.
 *
 * This block does not assert a pass mark for recall — it exists to document,
 * concretely, where the matcher gives up, and to make sure the failures are
 * *misses* (visible, recoverable) rather than *false ownership* (invisible).
 */
describe('matcher behaviour on hostile input', () => {
  const HOSTILE_COLLECTION = [
    // Untagged rip: rekordbox falls back to the filename.
    rb('h1', '', '01 - track01', 300000),
    // Artist and title crammed into the title field on the rekordbox side too.
    rb('h2', '', 'Skee Mask - Rio Duino', 380000),
    // Multi-artist spellings.
    rb('h3', 'Adriatique & WhoMadeWho', 'Miracle', 400000),
    rb('h4', 'Tale Of Us', 'Nothing Is Real', 420000),
    // Near-identical titles that are different records.
    rb('h5', 'Rival Consoles', 'Recovery', 310000),
    rb('h6', 'Rival Consoles', 'Recovery II', 330000),
    // Generic titles.
    rb('h7', 'Various', 'Intro', 60000),
    // Numerals.
    rb('h8', 'Roman Flügel', 'Wilkie', 355000),
  ];

  const HOSTILE_CASES = [
    {
      sc: sc('Skee Mask - Rio Duino', 'Ilian Tape', 380000),
      expect: 'h2',
      kind: 'artist-in-title-on-both-sides',
    },
    {
      sc: sc('Adriatique and WhoMadeWho - Miracle', 'Afterlife', 400000),
      expect: 'h3',
      kind: 'multi-artist-and',
    },
    {
      sc: sc('Adriatique x WhoMadeWho - Miracle', 'Afterlife', 400000),
      expect: 'h3',
      kind: 'multi-artist-x',
    },
    {
      sc: sc('Rival Consoles - Recovery II', 'Erased Tapes', 330000),
      expect: 'h6',
      kind: 'near-identical-title',
    },
    {
      sc: sc('Roman Flugel - Wilkie', 'Dial', 355000),
      expect: 'h8',
      kind: 'accented-artist',
    },
    {
      // The uploader renamed it entirely. Nothing can recover this.
      sc: sc('SUMMER VIBES MIX 2026', 'Some Channel', 300000),
      expect: null,
      kind: 'unrecoverable-rename',
    },
    {
      // Generic title, different artist — must not latch onto "Intro".
      sc: sc('Intro', 'A Completely Different Artist', 55000),
      expect: null,
      kind: 'generic-title',
      note: 'Owning some "Intro" must not mean owning every "Intro".',
    },
    {
      // Untagged rekordbox file: unmatchable by construction.
      sc: sc('Actual Artist - Actual Title', 'Label', 300000),
      expect: null,
      kind: 'untagged-target',
      note: 'The rekordbox side has no usable tags, so this is a known miss.',
    },
  ];

  const results = matchTracks(
    HOSTILE_CASES.map((testCase) => testCase.sc),
    HOSTILE_COLLECTION
  );
  const OWNED = new Set(['exact', 'strong']);

  test('reports how it handles each hostile case', () => {
    const rows = HOSTILE_CASES.map((testCase, position) => {
      const result = results[position];
      const claimed = result.rbTrack?.rbId ?? null;
      const tier = result.tier ?? 'none';
      const correct = claimed === testCase.expect;
      const owned = result.tier !== null && OWNED.has(result.tier);

      let verdict;
      if (correct && owned) verdict = 'matched';
      else if (correct) verdict = tier === 'fuzzy' ? 'review (correct)' : 'correctly absent';
      else if (owned) verdict = '*** FALSE OWNERSHIP ***';
      else if (tier === 'fuzzy') verdict = 'review (wrong target)';
      else verdict = 'missed';

      return `  ${testCase.kind.padEnd(32)} ${tier.padEnd(8)} ${verdict}`;
    });

    console.log(['', '  ── hostile corpus ───────────────────────────────', ...rows, ''].join('\n'));
    expect(rows).toHaveLength(HOSTILE_CASES.length);
  });

  test('degrades into misses, never into false ownership', () => {
    const falseOwnership = HOSTILE_CASES.filter((testCase, position) => {
      const result = results[position];
      const owned = result.tier !== null && OWNED.has(result.tier);
      return owned && (result.rbTrack?.rbId ?? null) !== testCase.expect;
    }).map((testCase) => testCase.kind);

    expect(falseOwnership).toEqual([]);
  });

  test('does not confuse two tracks whose titles differ by a numeral', () => {
    const position = HOSTILE_CASES.findIndex((testCase) => testCase.kind === 'near-identical-title');
    // Landing on "Recovery" when the user asked about "Recovery II" would be a
    // silent, wrong answer.
    expect(results[position].rbTrack?.rbId).not.toBe('h5');
  });

  test('does not let a generic title match across artists', () => {
    const position = HOSTILE_CASES.findIndex((testCase) => testCase.kind === 'generic-title');
    const result = results[position];
    expect(result.tier === null || result.tier === 'fuzzy').toBe(true);
  });
});
