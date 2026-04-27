function isUnavailable(track) {
  return track?.access === 'blocked' || track?.access === 'preview' || track?.streamable === false || Boolean(track?.blocked_at);
}

export function analyzePlaylistForAudit(playlist) {
  const tracks = Array.isArray(playlist?.tracks) ? playlist.tracks : [];
  const seen = new Set();
  const issues = [];
  let duplicateTracks = 0;
  let unavailableTracks = 0;
  let directDownloads = 0;
  let purchaseLinks = 0;

  for (const track of tracks) {
    if (!track?.id) continue;

    if (seen.has(track.id)) {
      duplicateTracks += 1;
      issues.push({
        type: 'duplicate',
        trackId: track.id,
        title: track.title,
      });
    } else {
      seen.add(track.id);
    }

    if (isUnavailable(track)) {
      unavailableTracks += 1;
      issues.push({
        type: 'unavailable',
        trackId: track.id,
        title: track.title,
        access: track.access || (track.streamable === false ? 'not_streamable' : 'blocked'),
      });
    }

    if (track.download_url || track.downloadable === true || track.downloadable === 'true') {
      directDownloads += 1;
    }
    if (track.purchase_url) {
      purchaseLinks += 1;
    }
  }

  return {
    id: playlist.id,
    title: playlist.title,
    trackCount: tracks.length || playlist.track_count || 0,
    permalink_url: playlist.permalink_url,
    artwork_url: playlist.artwork_url,
    summary: {
      totalTracks: tracks.length,
      duplicateTracks,
      unavailableTracks,
      directDownloads,
      purchaseLinks,
      nearCap: tracks.length >= 450,
    },
    issues,
  };
}

export function summarizeLibraryAudit(playlists) {
  const auditedPlaylists = playlists.map(analyzePlaylistForAudit);
  return {
    playlists: auditedPlaylists,
    summary: auditedPlaylists.reduce(
      (acc, playlist) => {
        acc.playlists += 1;
        acc.tracks += playlist.summary.totalTracks;
        acc.duplicates += playlist.summary.duplicateTracks;
        acc.unavailable += playlist.summary.unavailableTracks;
        acc.directDownloads += playlist.summary.directDownloads;
        acc.purchaseLinks += playlist.summary.purchaseLinks;
        acc.nearCap += playlist.summary.nearCap ? 1 : 0;
        return acc;
      },
      {
        playlists: 0,
        tracks: 0,
        duplicates: 0,
        unavailable: 0,
        directDownloads: 0,
        purchaseLinks: 0,
        nearCap: 0,
      }
    ),
  };
}
