/** Pure normalizers shaping SoundCloud API resources for our responses. */

export function extractNumericId(maybe) {
  if (maybe == null) return undefined;
  if (typeof maybe === 'number') return maybe;
  if (typeof maybe === 'string') {
    const n = Number(maybe);
    if (!Number.isNaN(n)) return n;
    // try urn like soundcloud:tracks:123
    const m = maybe.match(/(tracks|playlists|users):(\d+)/);
    if (m) return Number(m[2]);
  }
  return undefined;
}

export function normalizeResource(resource) {
  const kind = resource?.kind;
  if (kind === 'track') {
    const id = extractNumericId(resource.id || resource.urn);
    return {
      type: 'track',
      id,
      title: resource.title,
      user: { id: extractNumericId(resource.user?.id || resource.user?.urn), username: resource.user?.username },
      username: resource.user?.username,
      duration_ms: resource.duration,
      permalink_url: resource.permalink_url,
      artwork_url: resource.artwork_url || resource.user?.avatar_url,
      downloadable: resource.downloadable,
      download_url: resource.download_url,
      purchase_url: resource.purchase_url,
      purchase_title: resource.purchase_title
    };
  }
  if (kind === 'playlist') {
    const id = extractNumericId(resource.id || resource.urn);
    return {
      type: 'playlist',
      id,
      title: resource.title,
      user: { id: extractNumericId(resource.user?.id || resource.user?.urn), username: resource.user?.username },
      username: resource.user?.username,
      track_count: resource.track_count,
      permalink_url: resource.permalink_url,
      artwork_url: resource.artwork_url || resource.user?.avatar_url
    };
  }
  if (kind === 'user') {
    const id = extractNumericId(resource.id || resource.urn);
    return {
      type: 'user',
      id,
      username: resource.username,
      followers_count: resource.followers_count,
      permalink_url: resource.permalink_url,
      avatar_url: resource.avatar_url
    };
  }
  // Fallback heuristic
  if (resource.track) return normalizeResource({ ...resource.track, kind: 'track' });
  if (resource.playlist) return normalizeResource({ ...resource.playlist, kind: 'playlist' });
  if (resource.username) return normalizeResource({ ...resource, kind: 'user' });
  return null;
}

export function normalizeResourceV2(resource) {
  const base = normalizeResource(resource);
  if (!base) return null;

  if (base.type === 'track') {
    return {
      ...base,
      kind: 'track',
      duration: base.duration_ms,
      description: resource.description || null,
      genre: resource.genre || null,
      tag_list: resource.tag_list || null,
      created_at: resource.created_at || null,
      playback_count: resource.playback_count ?? null,
      likes_count: resource.likes_count ?? resource.favoritings_count ?? null,
      reposts_count: resource.reposts_count ?? null,
      comment_count: resource.comment_count ?? null
    };
  }
  if (base.type === 'playlist') {
    return {
      ...base,
      kind: 'playlist',
      description: resource.description || null,
      genre: resource.genre || null,
      tag_list: resource.tag_list || null,
      created_at: resource.created_at || null,
      likes_count: resource.likes_count ?? resource.favoritings_count ?? null,
      reposts_count: resource.reposts_count ?? null
    };
  }
  return {
    ...base,
    kind: 'user',
    full_name: resource.full_name || null,
    description: resource.description || null,
    followings_count: resource.followings_count ?? null,
    track_count: resource.track_count ?? null,
    playlist_count: resource.playlist_count ?? null,
    likes_count: resource.likes_count ?? resource.public_favorites_count ?? null
  };
}

export function normalizeTrackForLibraryBrowser(track) {
  const id = extractNumericId(track?.id || track?.urn);
  if (!id) return null;
  return {
    id,
    title: track.title || 'Untitled track',
    user: {
      id: extractNumericId(track.user?.id || track.user?.urn),
      username: track.user?.username || 'Unknown',
    },
    artwork_url: track.artwork_url || track.user?.avatar_url || null,
    duration: track.duration ?? null,
    permalink_url: track.permalink_url || null,
    streamable: track.streamable,
    access: track.access || null,
  };
}

export function normalizePlaylistForLibraryBrowser(playlist) {
  const id = extractNumericId(playlist?.id || playlist?.urn);
  if (!id) return null;
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const firstTrackArtwork = tracks.find((track) => track?.artwork_url)?.artwork_url;
  return {
    id,
    title: playlist.title || 'Untitled playlist',
    user: {
      id: extractNumericId(playlist.user?.id || playlist.user?.urn),
      username: playlist.user?.username || 'Unknown',
    },
    artwork_url: playlist.artwork_url || firstTrackArtwork || playlist.user?.avatar_url || null,
    permalink_url: playlist.permalink_url || null,
    track_count: playlist.track_count ?? tracks.length,
    likes_count: playlist.likes_count ?? playlist.favoritings_count ?? null,
    reposts_count: playlist.reposts_count ?? null,
  };
}
