function trackId(track) {
  return typeof track === 'number' ? track : track?.id;
}

function normalizeTrack(track) {
  return typeof track === 'number' ? { id: track } : track;
}

function uniqueTracks(tracks) {
  const seen = new Set();
  const unique = [];

  for (const track of tracks) {
    if (track?.id == null || seen.has(track.id)) continue;
    seen.add(track.id);
    unique.push(track);
  }

  return unique;
}

/**
 * Compare two SoundCloud playlists by unique track id.
 *
 * Expected input shape: `{ id, title, tracks }`, where `tracks` is an array of
 * track objects with an `id` field or numeric track ids. `overlapPercent` is the
 * Jaccard overlap: `|A intersect B| / |A union B|`, expressed as a percentage.
 */
export function comparePlaylists(playlistA, playlistB) {
  const tracksA = uniqueTracks((playlistA.tracks || []).map(normalizeTrack));
  const tracksB = uniqueTracks((playlistB.tracks || []).map(normalizeTrack));
  const idsA = new Set(tracksA.map(trackId));
  const idsB = new Set(tracksB.map(trackId));

  const overlap = tracksA.filter((track) => idsB.has(track.id));
  const uniqueToA = tracksA.filter((track) => !idsB.has(track.id));
  const uniqueToB = tracksB.filter((track) => !idsA.has(track.id));
  const unionCount = new Set([...idsA, ...idsB]).size;

  return {
    summary: {
      playlistA: {
        id: playlistA.id,
        title: playlistA.title,
        trackCount: tracksA.length,
      },
      playlistB: {
        id: playlistB.id,
        title: playlistB.title,
        trackCount: tracksB.length,
      },
      overlapCount: overlap.length,
      uniqueToACount: uniqueToA.length,
      uniqueToBCount: uniqueToB.length,
      overlapPercent: unionCount ? Math.round((overlap.length / unionCount) * 100) : 0,
    },
    overlap,
    uniqueToA,
    uniqueToB,
  };
}
