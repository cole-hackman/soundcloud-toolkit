/**
 * Browser-side entry point for the rekordbox sync tools.
 *
 * The parsing and matching logic lives in `server/lib/` so the Jest suite can
 * exercise the exact code the browser runs, rather than a mirrored copy. Those
 * modules are deliberately free of Node and DOM APIs, so they bundle fine.
 *
 * Nothing here talks to the network. The collection file is read, parsed, and
 * compared entirely in the tab — it holds absolute paths to the user's own
 * music files, and uploading those is neither necessary nor ours to do.
 */

export {
  looksLikeRekordboxXml,
  parseRekordboxXml,
} from "../../../../server/lib/rekordbox-xml.js";

export {
  buildRekordboxIndex,
  matchTracks,
  normalizeText,
} from "../../../../server/lib/rekordbox-match.js";

export {
  buildSyncReport,
  comparePlaylistPair,
  compareSourceToLibrary,
  findRekordboxOnly,
  pairPlaylists,
  playlistNameAffinity,
} from "../../../../server/lib/rekordbox-report.js";

export interface RekordboxTrack {
  rbId: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number | null;
  key: string;
  durationMs: number | null;
  rating: number | null;
  playCount: number | null;
  dateAdded: string;
  /** Absolute path on the user's machine. Never send this anywhere. */
  location: string;
}

export interface RekordboxPlaylist {
  name: string;
  path: string;
  trackIds: string[];
}

export interface RekordboxLibrary {
  tracks: RekordboxTrack[];
  playlists: RekordboxPlaylist[];
  meta: {
    declaredEntries: number | null;
    parsedEntries: number;
    product: string;
    version: string;
  };
}

export type MatchTier = "exact" | "strong" | "fuzzy" | null;

export interface ScTrackSummary {
  id: number;
  title: string;
  artist: string;
  permalinkUrl: string;
  durationMs: number | null;
  artworkUrl: string;
  downloadable: boolean;
  purchaseUrl: string;
}

export interface RbTrackSummary {
  rbId: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string;
  genre: string;
  durationMs: number | null;
  dateAdded: string;
  rating: number | null;
  playCount: number | null;
}

export interface MatchEntry {
  track: ScTrackSummary;
  rekordbox: RbTrackSummary | null;
  tier: MatchTier;
  score: number;
  durationDeltaMs: number | null;
}

export interface SourceComparison {
  sourceId: string;
  label: string;
  summary: {
    total: number;
    owned: number;
    missing: number;
    needsReview: number;
    coveragePercent: number;
  };
  missing: MatchEntry[];
  owned: MatchEntry[];
  review: MatchEntry[];
}

export interface PlaylistDrift {
  soundcloud: { id: string | number; title: string; trackCount: number };
  rekordbox: { name: string; path: string; trackCount: number };
  summary: {
    inBoth: number;
    missingFromLibrary: number;
    inLibraryNotPlaylist: number;
    onlyInRekordbox: number;
  };
  missingFromLibrary: MatchEntry[];
  inLibraryNotPlaylist: MatchEntry[];
  onlyInRekordbox: RbTrackSummary[];
}

export interface SyncReport {
  library: {
    trackCount: number;
    playlistCount: number;
    product: string;
    version: string;
  };
  comparisons: SourceComparison[];
  drift: PlaylistDrift[];
  rekordboxOnly: RbTrackSummary[];
  totals: {
    soundcloudTracks: number;
    uniqueMissing: number;
    needsReview: number;
    rekordboxOnly: number;
  };
}

export interface SyncSource {
  id: string;
  label: string;
  tracks: unknown[];
}
