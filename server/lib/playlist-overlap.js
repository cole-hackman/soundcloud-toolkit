/**
 * Given flat IndexedPlaylistTrack rows, compute the most-overlapping playlist
 * pairs ranked by shared track count. overlapPercent is Jaccard (|A∩B|/|A∪B|).
 * Pairs with zero overlap are omitted.
 */
export function topOverlappingPlaylists(rows, { limit = 10 } = {}) {
  const byPlaylist = new Map(); // id -> { title, tracks:Set }
  for (const row of rows) {
    let entry = byPlaylist.get(row.playlistId);
    if (!entry) {
      entry = { title: row.playlistTitle ?? null, tracks: new Set() };
      byPlaylist.set(row.playlistId, entry);
    }
    entry.tracks.add(row.trackId);
  }

  const ids = [...byPlaylist.keys()];
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = byPlaylist.get(ids[i]);
      const b = byPlaylist.get(ids[j]);
      let shared = 0;
      for (const t of a.tracks) if (b.tracks.has(t)) shared++;
      if (shared === 0) continue;
      const union = a.tracks.size + b.tracks.size - shared;
      pairs.push({
        playlistA: { id: ids[i], title: a.title },
        playlistB: { id: ids[j], title: b.title },
        sharedTracks: shared,
        overlapPercent: union ? Math.round((shared / union) * 100) : 0,
      });
    }
  }

  pairs.sort((x, y) => y.sharedTracks - x.sharedTracks || y.overlapPercent - x.overlapPercent);
  return pairs.slice(0, limit);
}
