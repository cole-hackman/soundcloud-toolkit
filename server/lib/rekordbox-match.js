/**
 * Fuzzy matching between SoundCloud tracks and a rekordbox collection.
 *
 * The two sides share no identifier, so every match is inferred from text.
 * The hard part is that the sides are shaped differently:
 *
 *   rekordbox  — clean ID3 tags, artist and title in separate fields.
 *                Artist="Nightmares On Wax"  Name="Les Nuits (Original Mix)"
 *
 *   SoundCloud — one free-text title plus an *uploader*, who is frequently a
 *                label or promo channel rather than the artist.
 *                title="[PREMIERE] Nightmares On Wax - Les Nuits [WARP001]"
 *                user.display_name="Warp Records"
 *
 * So a SoundCloud track yields several plausible readings ("candidates") and we
 * keep the best-scoring one.
 *
 * The one thing this module refuses to do is collapse different *versions* of a
 * track. A DJ who owns both the original and the Âme remix has two records, and
 * reporting either as a match for the other would be worse than reporting a
 * miss — so version text is extracted and compared as its own field.
 */

/** Bracketed text containing one of these describes a version, not noise. */
const VERSION_KEYWORDS = [
  'remix',
  'rmx',
  'mix',
  'edit',
  'rework',
  'bootleg',
  'vip',
  'dub',
  'version',
  'flip',
  'mashup',
  'refix',
  'instrumental',
  'acapella',
  'accapella',
  'extended',
  'radio',
  'club',
  'original',
  'remaster',
  'remastered',
  'live',
  'remake',
  'reprise',
  'interlude',
];

/** Promotional decoration that carries no identifying information. */
const NOISE_PATTERNS = [
  /\bpremiere\b/i,
  /\bfree\s*(download|dl)\b/i,
  /\bfree\b\s*$/i,
  /\bout\s*now\b/i,
  /\bexclusive\b/i,
  /\bforthcoming\b/i,
  /\bbuy\b/i,
  /\bsupport\b/i,
  /\bteaser\b/i,
  /\bsnippet\b/i,
  /\bpreview\b/i,
  /\bclip\b/i,
  /\bout\s*on\b/i,
  /\bdownload\s*in\s*description\b/i,
];

/**
 * Version strings that mean "this is just the track". rekordbox tags often say
 * "Original Mix" where SoundCloud says nothing at all.
 */
const NEUTRAL_VERSIONS = new Set(['', 'original', 'original mix', 'original version']);

/** Leading decoration such as `[PREMIERE]`, `FREE DOWNLOAD |`, `PREMIERE:`. */
const LEADING_NOISE = /^\s*(?:[[({][^\])}]*[\])}]|[^-|:•]{0,40}?(?:premiere|free\s*(?:download|dl)|out\s*now|exclusive))\s*(?:[|:•\-–—]+\s*)?/i;

/** A catalogue number such as `WARP001` or `TRUE 012`. */
const CATALOGUE_NUMBER = /^[a-z&.\s]{2,12}\s?\d{2,5}$/i;

/**
 * @typedef {Object} Fingerprint
 * @property {string} artist   Normalized artist.
 * @property {string} title    Normalized title, version and feat. removed.
 * @property {string} version  Normalized version ("" when none/original).
 * @property {string} feat     Normalized featured artists.
 * @property {string} raw      Human-readable "Artist - Title" for display.
 */

/**
 * @typedef {Object} MatchResult
 * @property {any} scTrack
 * @property {import('./rekordbox-xml.js').RekordboxTrack|null} rbTrack
 * @property {'exact'|'strong'|'fuzzy'|null} tier
 * @property {number} score            0–1 confidence.
 * @property {number|null} durationDeltaMs
 * @property {Fingerprint} fingerprint The SoundCloud reading that matched best.
 */

/**
 * Fold accents, unify separators, and drop punctuation so that
 * "Björk – Jóga" and "Bjork - Joga" compare equal.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeText(value) {
  if (!value) return '';

  return String(value)
    .normalize('NFKD')
    // Combining marks left behind by NFKD (the accents themselves).
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\bpt\.?\b/g, 'part')
    // Any remaining punctuation becomes a separator rather than vanishing, so
    // "re:work" tokenizes as two words instead of one.
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function tokenize(value) {
  return normalizeText(value).split(' ').filter(Boolean);
}

/**
 * Strip promo decoration from a raw title.
 *
 * @param {string} title
 * @returns {string}
 */
export function stripPromoNoise(title) {
  let result = String(title || '');
  let previous;

  // Leading decoration stacks ("[PREMIERE] [FREE DL] Artist - Track"), so peel
  // repeatedly until the string stops changing.
  do {
    previous = result;
    result = result.replace(LEADING_NOISE, '');
  } while (result !== previous && result.length > 0);

  return result.trim();
}

/**
 * Decide whether a bracketed fragment is version information or noise.
 *
 * @param {string} inner
 * @returns {boolean}
 */
function isVersionFragment(inner) {
  const normalized = normalizeText(inner);
  if (!normalized) return false;
  return VERSION_KEYWORDS.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(normalized));
}

/**
 * @param {string} inner
 * @returns {boolean}
 */
function isNoiseFragment(inner) {
  if (CATALOGUE_NUMBER.test(inner.trim())) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(inner));
}

/**
 * Split a title into its base name and version.
 *
 * Handles both conventions DJs see in the wild: bracketed
 * ("Les Nuits (Ame Remix)") and dash-suffixed ("Les Nuits - Extended Mix",
 * which is how Beatport-sourced ID3 tags usually land in rekordbox).
 *
 * Bracketed fragments that are neither version nor recognized noise — label
 * names, for instance — are dropped, because rekordbox tags rarely carry them
 * and keeping them would suppress otherwise-good matches.
 *
 * @param {string} title
 * @returns {{ title: string, version: string }}
 */
export function extractVersion(title) {
  let working = String(title || '');
  /** @type {string[]} */
  const versions = [];

  working = working.replace(/[[({]([^\])}]*)[\])}]/g, (match, inner) => {
    if (isVersionFragment(inner) && !isNoiseFragment(inner)) {
      versions.push(inner.trim());
    }
    return ' ';
  });

  // A trailing " - Extended Mix" is a version; a trailing " - Some Title" is
  // part of the name, so require a version keyword before consuming it.
  const dashMatch = /^(.*\S)\s+[-–—]\s+([^-–—]+)$/.exec(working.trim());
  if (dashMatch && isVersionFragment(dashMatch[2]) && !isNoiseFragment(dashMatch[2])) {
    versions.unshift(dashMatch[2].trim());
    working = dashMatch[1];
  }

  return {
    title: working.replace(/\s+/g, ' ').trim(),
    version: versions.join(' ').trim(),
  };
}

/**
 * Pull featured artists out of a title so they don't distort title similarity.
 *
 * @param {string} title
 * @returns {{ title: string, feat: string }}
 */
export function extractFeaturing(title) {
  let feat = '';

  const working = String(title || '').replace(
    /\s*[[(]?\b(?:feat|ft|featuring|w\/|with)\.?\s+([^)\]]+)[)\]]?\s*$/i,
    (match, artists) => {
      feat = artists.trim();
      return ' ';
    }
  );

  return { title: working.replace(/\s+/g, ' ').trim(), feat };
}

/**
 * Split "Artist - Title" when a single free-text field holds both.
 *
 * @param {string} text
 * @returns {{ artist: string, title: string }|null}
 */
export function splitArtistTitle(text) {
  const match = /^(.{1,80}?)\s+[-–—]\s+(.+)$/.exec(String(text || '').trim());
  if (!match) return null;

  const artist = match[1].trim();
  const title = match[2].trim();
  if (!artist || !title) return null;

  return { artist, title };
}

/**
 * Build a comparable fingerprint from an artist/title pair.
 *
 * @param {string} artist
 * @param {string} title
 * @returns {Fingerprint}
 */
export function buildFingerprint(artist, title) {
  const cleanedTitle = stripPromoNoise(title);
  const withoutVersion = extractVersion(cleanedTitle);
  const withoutFeat = extractFeaturing(withoutVersion.title);

  const normalizedArtist = normalizeText(stripPromoNoise(artist));
  const normalizedVersion = normalizeText(withoutVersion.version);

  return {
    artist: normalizedArtist,
    title: normalizeText(withoutFeat.title),
    version: NEUTRAL_VERSIONS.has(normalizedVersion) ? '' : normalizedVersion,
    feat: normalizeText(withoutFeat.feat),
    raw: `${artist || 'Unknown Artist'} - ${title || 'Untitled'}`,
  };
}

/**
 * Sørensen–Dice coefficient over character bigrams.
 *
 * Chosen over edit distance because it tolerates reordering and extra words,
 * which is the common failure mode here ("Track (feat. X)" vs "Track").
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1.
 */
export function stringSimilarity(a, b) {
  if (a === b) return a ? 1 : 0;
  if (!a || !b) return 0;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  /** @type {Map<string, number>} */
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const bigram = a.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const bigram = b.slice(i, i + 2);
    const count = bigrams.get(bigram) || 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

/**
 * Token-set overlap, which rescues "Artist Name" vs "Name, Artist".
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1.
 */
function tokenOverlap(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }

  return shared / Math.min(tokensA.size, tokensB.size);
}

/**
 * Blend character- and token-level similarity.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1.
 */
export function fieldSimilarity(a, b) {
  if (a === b) return a ? 1 : 0;
  return Math.max(stringSimilarity(a, b), tokenOverlap(a, b) * 0.95);
}

/**
 * Two versions are compatible when they agree, or when both are "the original".
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function versionsCompatible(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return fieldSimilarity(a, b) >= 0.8;
}

/**
 * Every plausible reading of a SoundCloud track.
 *
 * @param {any} scTrack
 * @returns {Fingerprint[]}
 */
export function soundcloudCandidates(scTrack) {
  const rawTitle = scTrack?.title || '';
  const uploader =
    scTrack?.user?.display_name?.trim() ||
    scTrack?.user?.full_name?.trim() ||
    scTrack?.user?.username?.trim() ||
    '';

  /** @type {Fingerprint[]} */
  const candidates = [buildFingerprint(uploader, rawTitle)];

  // "Label — Artist - Track": the artist is inside the title, not the uploader.
  const split = splitArtistTitle(stripPromoNoise(rawTitle));
  if (split) {
    candidates.push(buildFingerprint(split.artist, split.title));
    // ...and the reverse, since "Track - Artist" ordering also occurs.
    candidates.push(buildFingerprint(split.title, split.artist));
  }

  return candidates;
}

/**
 * @param {import('./rekordbox-xml.js').RekordboxTrack} rbTrack
 * @returns {Fingerprint}
 */
export function rekordboxFingerprint(rbTrack) {
  return buildFingerprint(rbTrack.artist || '', rbTrack.title || '');
}

/**
 * Score one candidate reading against one rekordbox fingerprint.
 *
 * @param {Fingerprint} sc
 * @param {Fingerprint} rb
 * @returns {{ tier: 'exact'|'strong'|'fuzzy'|null, score: number }}
 */
export function scorePair(sc, rb) {
  const titleSimilarity = fieldSimilarity(sc.title, rb.title);
  const artistSimilarity = fieldSimilarity(sc.artist, rb.artist);
  const versionOk = versionsCompatible(sc.version, rb.version);

  // Different versions of the same song are different records. Refuse the
  // match outright rather than letting a high title score paper over it.
  if (!versionOk && (sc.version || rb.version)) {
    return { tier: null, score: 0 };
  }

  const score = titleSimilarity * 0.62 + artistSimilarity * 0.38;

  if (sc.title === rb.title && sc.artist === rb.artist && sc.version === rb.version) {
    return { tier: 'exact', score: 1 };
  }

  // Same title and version, artist merely spelled differently (or missing on
  // one side, which happens when a SoundCloud upload has no artist in it).
  if (sc.title === rb.title && (artistSimilarity >= 0.55 || !sc.artist || !rb.artist)) {
    return { tier: 'strong', score: Math.max(score, 0.8) };
  }

  if (titleSimilarity >= 0.82 && artistSimilarity >= 0.5) {
    return { tier: 'strong', score };
  }

  if (score >= 0.72 && titleSimilarity >= 0.6) {
    return { tier: 'fuzzy', score };
  }

  // An exact title match whose artists don't agree is still worth surfacing:
  // SoundCloud uploads are routinely credited to a label, an alias, or a promo
  // channel, so the artist field disagreeing is weak evidence of anything. It
  // goes to the review bucket rather than counting as owned. Short or
  // single-word titles are excluded — "Intro" would otherwise match half a
  // collection.
  if (sc.title === rb.title && sc.title.length >= 6 && sc.title.includes(' ')) {
    return { tier: 'fuzzy', score: Math.max(score, 0.65) };
  }

  return { tier: null, score };
}

/**
 * Index a rekordbox collection for lookup.
 *
 * Comparing every SoundCloud track against every rekordbox track is
 * O(n·m) — 5k likes against a 20k-track collection is 100M comparisons, far
 * too slow for the browser. Candidates are therefore narrowed by shared title
 * token first, and only that shortlist is scored.
 *
 * @param {import('./rekordbox-xml.js').RekordboxTrack[]} rbTracks
 */
export function buildRekordboxIndex(rbTracks) {
  /** @type {Map<string, number[]>} */
  const byTitle = new Map();
  /** @type {Map<string, number[]>} */
  const byToken = new Map();
  /** @type {Fingerprint[]} */
  const fingerprints = [];

  rbTracks.forEach((track, index) => {
    const fingerprint = rekordboxFingerprint(track);
    fingerprints.push(fingerprint);

    const titleBucket = byTitle.get(fingerprint.title);
    if (titleBucket) titleBucket.push(index);
    else byTitle.set(fingerprint.title, [index]);

    for (const token of new Set(fingerprint.title.split(' ').filter(Boolean))) {
      const tokenBucket = byToken.get(token);
      if (tokenBucket) tokenBucket.push(index);
      else byToken.set(token, [index]);
    }
  });

  return { tracks: rbTracks, fingerprints, byTitle, byToken };
}

/** Tokens present in more than this share of the library are too weak to block on. */
const COMMON_TOKEN_RATIO = 0.08;
/** Upper bound on fingerprints scored per SoundCloud track. */
const MAX_CANDIDATES = 300;

/**
 * Collect rekordbox row indices worth scoring for a given candidate.
 *
 * @param {ReturnType<typeof buildRekordboxIndex>} index
 * @param {Fingerprint} fingerprint
 * @returns {number[]}
 */
function shortlist(index, fingerprint) {
  const exact = index.byTitle.get(fingerprint.title);
  if (exact && exact.length > 0) return exact;

  const tokens = fingerprint.title.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const librarySize = index.fingerprints.length;
  /** @type {Map<number, number>} */
  const hits = new Map();

  // Rare tokens carry the most signal, so consult them first and stop once the
  // shortlist is big enough.
  const ordered = tokens
    .map((token) => ({ token, bucket: index.byToken.get(token) || [] }))
    .filter((entry) => entry.bucket.length > 0)
    .sort((a, b) => a.bucket.length - b.bucket.length);

  for (const { bucket } of ordered) {
    const tooCommon = bucket.length > Math.max(50, librarySize * COMMON_TOKEN_RATIO);
    // A token this common only helps if nothing rarer matched anything.
    if (tooCommon && hits.size > 0) continue;

    for (const rowIndex of bucket) {
      hits.set(rowIndex, (hits.get(rowIndex) || 0) + 1);
    }

    if (hits.size >= MAX_CANDIDATES) break;
  }

  return [...hits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CANDIDATES)
    .map(([rowIndex]) => rowIndex);
}

/** Beyond this the two files are different recordings, whatever the text says. */
const DURATION_TOLERANCE_MS = 20000;

/**
 * Match a set of SoundCloud tracks against a rekordbox collection.
 *
 * @param {any[]} scTracks
 * @param {import('./rekordbox-xml.js').RekordboxTrack[]} rbTracks
 * @param {{ minTier?: 'exact'|'strong'|'fuzzy', index?: ReturnType<typeof buildRekordboxIndex> }} [options]
 * @returns {MatchResult[]} One entry per input track, in input order.
 */
export function matchTracks(scTracks, rbTracks, options = {}) {
  const index = options.index || buildRekordboxIndex(rbTracks);
  const minTier = options.minTier || 'fuzzy';
  const tierRank = { exact: 3, strong: 2, fuzzy: 1 };
  const floor = tierRank[minTier];

  return scTracks.map((scTrack) => {
    const candidates = soundcloudCandidates(scTrack);
    const scDuration = typeof scTrack?.duration === 'number' ? scTrack.duration : null;

    /** @type {MatchResult} */
    let best = {
      scTrack,
      rbTrack: null,
      tier: null,
      score: 0,
      durationDeltaMs: null,
      fingerprint: candidates[0],
    };

    for (const candidate of candidates) {
      for (const rowIndex of shortlist(index, candidate)) {
        const rbFingerprint = index.fingerprints[rowIndex];
        const { tier, score } = scorePair(candidate, rbFingerprint);
        if (!tier || tierRank[tier] < floor) continue;

        const rbTrack = index.tracks[rowIndex];
        const durationDeltaMs =
          scDuration !== null && rbTrack.durationMs !== null
            ? Math.abs(scDuration - rbTrack.durationMs)
            : null;

        // Runtime disagreement is strong evidence against a match — it's what
        // separates a radio edit from the extended mix when both are tagged
        // identically. An exact text match survives it, but flagged.
        let adjusted = score;
        if (durationDeltaMs !== null && durationDeltaMs > DURATION_TOLERANCE_MS) {
          if (tier !== 'exact') adjusted = score * 0.6;
          if (adjusted < 0.6 && tier !== 'exact') continue;
        }

        if (adjusted > best.score) {
          best = {
            scTrack,
            rbTrack,
            tier,
            score: adjusted,
            durationDeltaMs,
            fingerprint: candidate,
          };
        }

        if (tier === 'exact' && (durationDeltaMs === null || durationDeltaMs <= DURATION_TOLERANCE_MS)) {
          return best;
        }
      }
    }

    return best;
  });
}
