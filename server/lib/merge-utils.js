export function dedupeTrackIds(trackIds) {
  const seen = new Set();
  const unique = [];
  for (const id of trackIds) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
}

export function mergePlaylistsTrackIds(playlists) {
  // playlists: Array<{ tracks: Array<{ id: number }> }>
  const all = [];
  for (const p of playlists) {
    for (const t of (p.tracks || [])) {
      all.push(t.id);
    }
  }
  return dedupeTrackIds(all);
}


