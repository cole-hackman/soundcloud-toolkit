function readCount(value, fallback) {
  if (typeof value === 'number' && value > 0) return value;
  return fallback;
}

function collectionCount(payload) {
  if (!payload) return 0;
  if (typeof payload.total === 'number') return payload.total;
  if (typeof payload.total_results === 'number') return payload.total_results;
  if (Array.isArray(payload.collection)) return payload.collection.length;
  if (Array.isArray(payload)) return payload.length;
  return 0;
}

export function buildDashboardSummary({
  me,
  playlists,
  likes,
  followings,
  followers,
}) {
  return {
    followers_count: readCount(me?.followers_count, collectionCount(followers)),
    followings_count: readCount(me?.followings_count, collectionCount(followings)),
    likes_count: readCount(
      me?.public_favorites_count ?? me?.likes_count,
      collectionCount(likes),
    ),
    playlist_count: readCount(me?.playlist_count, collectionCount(playlists)),
  };
}
