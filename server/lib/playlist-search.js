/**
 * Keyword search across playlist track lists, plus the pure list surgery the
 * bulk-remove route needs.
 *
 * Everything here is pure so the matching rules can be tested without touching
 * the SoundCloud API. The routes own fetching and pacing.
 */

/**
 * Split a raw query into keywords. Comma-separated terms are OR'd, so
 * "remix, bootleg" matches a track containing either. A query with no comma is
 * a single term and keeps its internal spaces, so "live set" stays one phrase
 * rather than becoming two loose words.
 */
export function parseKeywords(query) {
  if (typeof query !== 'string') return [];
  const seen = new Set();
  const keywords = [];
  for (const raw of query.split(',')) {
    const term = raw.trim().toLowerCase();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    keywords.push(term);
  }
  return keywords;
}

/**
 * First keyword that matches, and where it matched, or null.
 * Title is checked before artist so the reported field is the more useful one
 * when both hit.
 */
export function matchTrack(track, keywords) {
  if (!track || keywords.length === 0) return null;
  const title = String(track.title ?? '').toLowerCase();
  const artist = String(track.user?.username ?? '').toLowerCase();

  for (const keyword of keywords) {
    if (title.includes(keyword)) return { keyword, matchedIn: 'title' };
  }
  for (const keyword of keywords) {
    if (artist.includes(keyword)) return { keyword, matchedIn: 'artist' };
  }
  return null;
}

function toTrackId(value) {
  const id = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/**
 * Search a batch of already-fetched playlists.
 *
 * A track appearing in three playlists yields three matches, each carrying its
 * own playlistId — the caller needs that to remove it from the right list.
 */
export function searchTracksInPlaylists(playlists, keywords) {
  const matches = [];
  let tracksScanned = 0;
  let playlistsSearched = 0;

  for (const playlist of Array.isArray(playlists) ? playlists : []) {
    if (!playlist) continue;
    playlistsSearched += 1;
    const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];

    for (let position = 0; position < tracks.length; position += 1) {
      const track = tracks[position];
      tracksScanned += 1;
      const trackId = toTrackId(track?.id);
      if (trackId === null) continue;

      const hit = matchTrack(track, keywords);
      if (!hit) continue;

      matches.push({
        trackId,
        title: track.title || 'Untitled track',
        artist: track.user?.username || 'Unknown',
        artwork_url: track.artwork_url || null,
        permalink_url: track.permalink_url || null,
        duration: track.duration ?? null,
        position,
        playlistId: toTrackId(playlist.id),
        playlistTitle: playlist.title || 'Untitled playlist',
        keyword: hit.keyword,
        matchedIn: hit.matchedIn,
      });
    }
  }

  return {
    matches,
    stats: {
      playlistsSearched,
      tracksScanned,
      matchCount: matches.length,
      uniqueTrackCount: new Set(matches.map((m) => m.trackId)).size,
    },
  };
}

/**
 * Ordered track ids minus the ones being removed. Order of the survivors is
 * preserved, because the caller PUTs this back as the playlist's full list.
 */
export function removeTrackIds(orderedIds, idsToRemove) {
  const remove = new Set(idsToRemove);
  return orderedIds.filter((id) => !remove.has(id));
}

/**
 * Append ids to a playlist without duplicating what it already holds, stopping
 * at the 500-track ceiling SoundCloud enforces.
 *
 * Returns the new list plus what happened, so the route can tell the user
 * "added 12, skipped 3 already there, 5 did not fit".
 */
export function appendTrackIds(existingIds, idsToAdd, maxTracks) {
  const existing = new Set(existingIds);
  const next = [...existingIds];
  const added = [];
  const alreadyPresent = [];
  const noRoom = [];

  for (const id of idsToAdd) {
    if (existing.has(id)) {
      alreadyPresent.push(id);
      continue;
    }
    if (next.length >= maxTracks) {
      noRoom.push(id);
      continue;
    }
    next.push(id);
    existing.add(id);
    added.push(id);
  }

  return { nextIds: next, added, alreadyPresent, noRoom };
}
