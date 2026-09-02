/**
 * Turns raw SoundCloud↔rekordbox matches into the three questions a DJ
 * actually asks:
 *
 *   1. What have I saved on SoundCloud that isn't in my collection yet?
 *      (the crate-digging backlog — the reason this feature exists)
 *   2. What's in my collection that I never saved on SoundCloud?
 *   3. Where has a SoundCloud playlist drifted from its rekordbox counterpart?
 *
 * Everything here is pure: the caller supplies already-fetched SoundCloud data
 * and an already-parsed rekordbox library.
 */

import { buildRekordboxIndex, matchTracks, normalizeText } from './rekordbox-match.js';

/**
 * @typedef {Object} SyncSource
 * @property {string} id      Stable identifier — "likes" or a playlist id.
 * @property {string} label   Display name.
 * @property {any[]} tracks   SoundCloud track objects.
 */

/** Tiers we treat as "you already own this". */
const CONFIDENT_TIERS = new Set(['exact', 'strong']);

/**
 * @param {import('./rekordbox-match.js').MatchResult} match
 * @returns {boolean}
 */
function isConfident(match) {
  return match.tier !== null && CONFIDENT_TIERS.has(match.tier);
}

/**
 * Shrink a SoundCloud track to the fields the UI and exports need.
 *
 * @param {any} track
 */
function summarizeScTrack(track) {
  return {
    id: track?.id,
    title: track?.title || 'Untitled',
    artist:
      track?.user?.display_name?.trim() ||
      track?.user?.full_name?.trim() ||
      track?.user?.username?.trim() ||
      'Unknown Artist',
    permalinkUrl: track?.permalink_url || '',
    durationMs: typeof track?.duration === 'number' ? track.duration : null,
    artworkUrl: track?.artwork_url || '',
    // Surfaced so the "missing" list can be sorted by what's actually
    // obtainable — a free download is a click away, everything else isn't.
    downloadable: Boolean(track?.downloadable || track?.download_url),
    purchaseUrl: track?.purchase_url || '',
  };
}

/**
 * @param {import('./rekordbox-xml.js').RekordboxTrack} track
 */
function summarizeRbTrack(track) {
  return {
    rbId: track.rbId,
    title: track.title || 'Untitled',
    artist: track.artist || 'Unknown Artist',
    bpm: track.bpm,
    key: track.key,
    genre: track.genre,
    durationMs: track.durationMs,
    dateAdded: track.dateAdded,
    rating: track.rating,
    playCount: track.playCount,
  };
}

/**
 * Compare one set of SoundCloud tracks against the rekordbox collection.
 *
 * @param {SyncSource} source
 * @param {ReturnType<typeof buildRekordboxIndex>} index
 * @param {{ minTier?: 'exact'|'strong'|'fuzzy' }} [options]
 */
export function compareSourceToLibrary(source, index, options = {}) {
  const matches = matchTracks(source.tracks, index.tracks, {
    index,
    minTier: options.minTier || 'fuzzy',
  });

  const missing = [];
  const owned = [];
  const review = [];

  for (const match of matches) {
    const entry = {
      track: summarizeScTrack(match.scTrack),
      rekordbox: match.rbTrack ? summarizeRbTrack(match.rbTrack) : null,
      tier: match.tier,
      score: Math.round(match.score * 100) / 100,
      durationDeltaMs: match.durationDeltaMs,
    };

    if (isConfident(match)) owned.push(entry);
    else if (match.tier === 'fuzzy') review.push(entry);
    else missing.push(entry);
  }

  return {
    sourceId: source.id,
    label: source.label,
    summary: {
      total: source.tracks.length,
      owned: owned.length,
      missing: missing.length,
      needsReview: review.length,
      // "How much of this list could I actually play tonight?"
      coveragePercent: source.tracks.length
        ? Math.round((owned.length / source.tracks.length) * 100)
        : 0,
    },
    missing,
    owned,
    review,
  };
}

/**
 * Identify rekordbox tracks that no SoundCloud source accounted for.
 *
 * @param {ReturnType<typeof buildRekordboxIndex>} index
 * @param {ReturnType<typeof compareSourceToLibrary>[]} comparisons
 */
export function findRekordboxOnly(index, comparisons) {
  const claimed = new Set();

  for (const comparison of comparisons) {
    for (const entry of comparison.owned) {
      if (entry.rekordbox) claimed.add(entry.rekordbox.rbId);
    }
    // A fuzzy match is weak evidence, but it's enough to keep a track off the
    // "you never saved this" list, where a false positive is more annoying.
    for (const entry of comparison.review) {
      if (entry.rekordbox) claimed.add(entry.rekordbox.rbId);
    }
  }

  return index.tracks
    .filter((track) => !claimed.has(track.rbId))
    .map(summarizeRbTrack);
}

/**
 * Score how well two playlist names correspond.
 *
 * rekordbox folder paths are compared on their leaf name, so "House/Peak Time"
 * pairs with a SoundCloud playlist called "Peak Time".
 *
 * @param {string} scName
 * @param {string} rbName
 * @returns {number} 0–1.
 */
export function playlistNameAffinity(scName, rbName) {
  const a = normalizeText(scName);
  const b = normalizeText(rbName);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = new Set(a.split(' '));
  const tokensB = new Set(b.split(' '));
  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared += 1;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union ? shared / union : 0;
}

/** Below this, two playlist names are unrelated and shouldn't be auto-paired. */
const PLAYLIST_PAIR_THRESHOLD = 0.5;

/**
 * Pair SoundCloud playlists with rekordbox playlists by name.
 *
 * Greedy best-first: the strongest pair is taken, both sides are consumed, and
 * the process repeats. That keeps one popular rekordbox playlist from being
 * claimed by several SoundCloud playlists at once.
 *
 * @param {{ id: any, title: string }[]} scPlaylists
 * @param {import('./rekordbox-xml.js').RekordboxPlaylist[]} rbPlaylists
 */
export function pairPlaylists(scPlaylists, rbPlaylists) {
  const scored = [];

  scPlaylists.forEach((scPlaylist, scIndex) => {
    rbPlaylists.forEach((rbPlaylist, rbIndex) => {
      const affinity = playlistNameAffinity(scPlaylist.title || '', rbPlaylist.name || '');
      if (affinity >= PLAYLIST_PAIR_THRESHOLD) {
        scored.push({ scIndex, rbIndex, affinity });
      }
    });
  });

  scored.sort((a, b) => b.affinity - a.affinity);

  const usedSc = new Set();
  const usedRb = new Set();
  const pairs = [];

  for (const candidate of scored) {
    if (usedSc.has(candidate.scIndex) || usedRb.has(candidate.rbIndex)) continue;
    usedSc.add(candidate.scIndex);
    usedRb.add(candidate.rbIndex);
    pairs.push({
      soundcloud: scPlaylists[candidate.scIndex],
      rekordbox: rbPlaylists[candidate.rbIndex],
      affinity: Math.round(candidate.affinity * 100) / 100,
    });
  }

  return {
    pairs,
    unpairedSoundcloud: scPlaylists.filter((_, index) => !usedSc.has(index)),
    unpairedRekordbox: rbPlaylists.filter((_, index) => !usedRb.has(index)),
  };
}

/**
 * Diff a SoundCloud playlist against the rekordbox playlist it pairs with.
 *
 * Note the asymmetry with `compareSourceToLibrary`: a track can be *in your
 * collection* yet absent from the corresponding rekordbox playlist. That case
 * is called out separately, because the fix is a drag-and-drop rather than a
 * download.
 *
 * @param {SyncSource} scSource
 * @param {import('./rekordbox-xml.js').RekordboxPlaylist} rbPlaylist
 * @param {ReturnType<typeof buildRekordboxIndex>} index
 */
export function comparePlaylistPair(scSource, rbPlaylist, index) {
  const inPlaylist = new Set(rbPlaylist.trackIds);
  const matches = matchTracks(scSource.tracks, index.tracks, { index });

  const missingFromLibrary = [];
  const inLibraryNotPlaylist = [];
  const present = new Set();

  for (const match of matches) {
    const entry = {
      track: summarizeScTrack(match.scTrack),
      rekordbox: match.rbTrack ? summarizeRbTrack(match.rbTrack) : null,
      tier: match.tier,
      score: Math.round(match.score * 100) / 100,
    };

    if (!isConfident(match) || !match.rbTrack) {
      missingFromLibrary.push(entry);
      continue;
    }

    if (inPlaylist.has(match.rbTrack.rbId)) present.add(match.rbTrack.rbId);
    else inLibraryNotPlaylist.push(entry);
  }

  const byRbId = new Map(index.tracks.map((track) => [track.rbId, track]));
  const onlyInRekordbox = rbPlaylist.trackIds
    .filter((rbId) => !present.has(rbId))
    .map((rbId) => byRbId.get(rbId))
    .filter(Boolean)
    .map(summarizeRbTrack);

  return {
    soundcloud: { id: scSource.id, title: scSource.label, trackCount: scSource.tracks.length },
    rekordbox: { name: rbPlaylist.name, path: rbPlaylist.path, trackCount: rbPlaylist.trackIds.length },
    summary: {
      inBoth: present.size,
      missingFromLibrary: missingFromLibrary.length,
      inLibraryNotPlaylist: inLibraryNotPlaylist.length,
      onlyInRekordbox: onlyInRekordbox.length,
    },
    missingFromLibrary,
    inLibraryNotPlaylist,
    onlyInRekordbox,
  };
}

/**
 * Full sync report across every requested SoundCloud source.
 *
 * @param {{
 *   sources: SyncSource[],
 *   library: import('./rekordbox-xml.js').RekordboxLibrary,
 *   playlistPairs?: { source: SyncSource, rbPlaylist: import('./rekordbox-xml.js').RekordboxPlaylist }[],
 *   minTier?: 'exact'|'strong'|'fuzzy',
 * }} input
 */
export function buildSyncReport({ sources, library, playlistPairs = [], minTier = 'fuzzy' }) {
  const index = buildRekordboxIndex(library.tracks);
  const comparisons = sources.map((source) => compareSourceToLibrary(source, index, { minTier }));
  const rekordboxOnly = findRekordboxOnly(index, comparisons);

  const drift = playlistPairs.map(({ source, rbPlaylist }) =>
    comparePlaylistPair(source, rbPlaylist, index)
  );

  // A track missing from several sources is still one thing to go and find.
  const uniqueMissing = new Map();
  for (const comparison of comparisons) {
    for (const entry of comparison.missing) {
      if (entry.track.id != null && !uniqueMissing.has(entry.track.id)) {
        uniqueMissing.set(entry.track.id, entry);
      }
    }
  }

  return {
    library: {
      trackCount: library.tracks.length,
      playlistCount: library.playlists.length,
      product: library.meta.product,
      version: library.meta.version,
    },
    comparisons,
    drift,
    rekordboxOnly,
    totals: {
      soundcloudTracks: comparisons.reduce((sum, item) => sum + item.summary.total, 0),
      uniqueMissing: uniqueMissing.size,
      needsReview: comparisons.reduce((sum, item) => sum + item.summary.needsReview, 0),
      rekordboxOnly: rekordboxOnly.length,
    },
  };
}
