/**
 * Move or duplicate a single track between playlists using full track-list PUTs.
 * Preserves order; appends to target when adding.
 */

export const MAX_PLAYLIST_TRACKS = 500;

export function extractOrderedTrackIds(playlist) {
  const raw = playlist?.tracks;
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => (typeof t?.id === 'number' ? t.id : parseInt(t.id, 10))).filter((id) => Number.isInteger(id) && id >= 1);
}

/**
 * @param {object} deps
 * @param {string} deps.accessToken
 * @param {string} deps.refreshToken
 * @param {object} deps.client - soundcloud client with getPlaylistWithTracks, addTracksToPlaylist
 * @param {number} deps.trackId
 * @param {number} deps.targetPlaylistId
 */
export async function duplicateTrackBetweenPlaylists(deps) {
  const { accessToken, refreshToken, client, trackId, targetPlaylistId } = deps;

  if (targetPlaylistId === undefined || targetPlaylistId === null) {
    return { ok: false, error: 'Target playlist is required' };
  }

  const target = await client.getPlaylistWithTracks(accessToken, refreshToken, targetPlaylistId);
  const targetIds = extractOrderedTrackIds(target);

  if (targetIds.includes(trackId)) {
    return {
      ok: true,
      noop: true,
      message: 'Track is already in this playlist',
      targetPlaylistId,
      targetTitle: target.title ?? null,
    };
  }

  if (targetIds.length >= MAX_PLAYLIST_TRACKS) {
    return {
      ok: false,
      error: `Target playlist is full (${MAX_PLAYLIST_TRACKS} tracks max)`,
    };
  }

  const nextTargetIds = [...targetIds, trackId];
  await client.addTracksToPlaylist(accessToken, refreshToken, targetPlaylistId, nextTargetIds);

  return {
    ok: true,
    noop: false,
    action: 'duplicate',
    trackId,
    targetPlaylistId,
    targetTitle: target.title ?? null,
  };
}

/**
 * @param {object} deps
 * @param {number} deps.trackId
 * @param {number} deps.sourcePlaylistId
 * @param {number} deps.targetPlaylistId
 */
export async function moveTrackBetweenPlaylists(deps) {
  const { accessToken, refreshToken, client, trackId, sourcePlaylistId, targetPlaylistId } = deps;

  if (sourcePlaylistId === targetPlaylistId) {
    return { ok: false, error: 'Source and target playlist must be different' };
  }

  const [source, target] = await Promise.all([
    client.getPlaylistWithTracks(accessToken, refreshToken, sourcePlaylistId),
    client.getPlaylistWithTracks(accessToken, refreshToken, targetPlaylistId),
  ]);

  const sourceIds = extractOrderedTrackIds(source);
  const targetIds = extractOrderedTrackIds(target);

  if (!sourceIds.includes(trackId)) {
    return {
      ok: false,
      error: 'Track is not in the source playlist (it may have changed — refresh and try again)',
    };
  }

  const targetAlreadyHas = targetIds.includes(trackId);
  let nextTargetIds = targetIds;

  if (!targetAlreadyHas) {
    if (targetIds.length >= MAX_PLAYLIST_TRACKS) {
      return {
        ok: false,
        error: `Target playlist is full (${MAX_PLAYLIST_TRACKS} tracks max)`,
      };
    }
    nextTargetIds = [...targetIds, trackId];
  }

  try {
    await client.addTracksToPlaylist(accessToken, refreshToken, targetPlaylistId, nextTargetIds);
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Failed to update target playlist',
      stage: 'target_update',
    };
  }

  const nextSourceIds = sourceIds.filter((id) => id !== trackId);

  try {
    await client.addTracksToPlaylist(accessToken, refreshToken, sourcePlaylistId, nextSourceIds);
  } catch (err) {
    return {
      ok: false,
      partial: true,
      stage: 'source_update',
      targetUpdated: true,
      trackId,
      sourcePlaylistId,
      targetPlaylistId,
      sourceTitle: source.title ?? null,
      targetTitle: target.title ?? null,
      error: err?.message || 'Failed to remove track from source playlist',
      message:
        'The track was added to the target playlist, but it could not be removed from the source playlist. Remove it manually from the source playlist or try again.',
    };
  }

  return {
    ok: true,
    noop: false,
    action: 'move',
    trackId,
    sourcePlaylistId,
    targetPlaylistId,
    sourceTitle: source.title ?? null,
    targetTitle: target.title ?? null,
  };
}
