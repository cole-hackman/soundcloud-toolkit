import { normalizeGenre } from './genre-utils.js';

/** SC like payloads are sometimes the track itself, sometimes { track: {...} }. */
function unwrapTrack(like) {
  if (like && typeof like === 'object' && like.track && typeof like.track === 'object') {
    return like.track;
  }
  return like;
}

/** Map a SoundCloud like/track object to an IndexedLike row, or null if no track id. */
export function mapLikeToRow(userId, like) {
  const track = unwrapTrack(like);
  const trackId = track?.id;
  if (typeof trackId !== 'number') return null;
  const genre = typeof track.genre === 'string' ? track.genre : null;
  return {
    userId,
    trackId,
    title: track.title ?? null,
    artistName: track.user?.username ?? null,
    artistId: typeof track.user?.id === 'number' ? track.user.id : null,
    genre,
    genreNormalized: normalizeGenre(genre),
    tagList: typeof track.tag_list === 'string' ? track.tag_list : null,
    durationMs: typeof track.duration === 'number' ? track.duration : null,
    likedAt: track.created_at ? new Date(track.created_at) : null,
  };
}

/** Map a playlist (with tracks) to deduplicated IndexedPlaylistTrack rows. */
export function mapPlaylistTracksToRows(userId, playlist) {
  const playlistId = playlist?.id;
  if (typeof playlistId !== 'number') return [];
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const seen = new Set();
  const rows = [];
  for (const t of tracks) {
    const trackId = typeof t === 'number' ? t : t?.id;
    if (typeof trackId !== 'number' || seen.has(trackId)) continue;
    seen.add(trackId);
    rows.push({ userId, playlistId, playlistTitle: playlist.title ?? null, trackId });
  }
  return rows;
}
