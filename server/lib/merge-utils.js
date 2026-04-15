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

/**
 * Merge source track IDs into an existing playlist's track IDs.
 * Preserves the order of existingIds and appends new unique tracks from sourceIds.
 * @param {number[]} existingIds - Track IDs already in the target playlist
 * @param {number[]} sourceIds - Track IDs from source playlists
 * @returns {{ mergedIds: number[], addedCount: number }}
 */
export function mergeIntoExisting(existingIds, sourceIds) {
  const seen = new Set(existingIds);
  const newIds = [];
  for (const id of sourceIds) {
    if (!seen.has(id)) {
      seen.add(id);
      newIds.push(id);
    }
  }
  return {
    mergedIds: [...existingIds, ...newIds],
    addedCount: newIds.length,
  };
}

/**
 * Split an array of track IDs into chunks of at most maxSize.
 * @param {number[]} trackIds - Array of track IDs to split
 * @param {number} [maxSize=500] - Maximum chunk size
 * @returns {number[][]} Array of arrays, each with at most maxSize elements
 */
export function splitIntoChunks(trackIds, maxSize = 500) {
  if (maxSize < 1) maxSize = 1;
  const chunks = [];
  for (let i = 0; i < trackIds.length; i += maxSize) {
    chunks.push(trackIds.slice(i, i + maxSize));
  }
  return chunks;
}


