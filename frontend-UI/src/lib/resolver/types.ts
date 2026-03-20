export type ResolverResourceType = "track" | "playlist" | "user";

export interface ResolverBase {
  type: ResolverResourceType;
  kind: ResolverResourceType;
  id?: number;
  permalink_url?: string;
}

export interface ResolverTrack extends ResolverBase {
  type: "track";
  kind: "track";
  title?: string;
  username?: string;
  user?: { id?: number; username?: string };
  duration_ms?: number;
  duration?: number;
  artwork_url?: string;
  downloadable?: boolean;
  download_url?: string | null;
  purchase_url?: string | null;
  purchase_title?: string | null;
  description?: string | null;
  genre?: string | null;
  tag_list?: string | null;
  created_at?: string | null;
  playback_count?: number | null;
  likes_count?: number | null;
  reposts_count?: number | null;
  comment_count?: number | null;
}

export interface ResolverPlaylist extends ResolverBase {
  type: "playlist";
  kind: "playlist";
  title?: string;
  username?: string;
  user?: { id?: number; username?: string };
  track_count?: number;
  artwork_url?: string;
  description?: string | null;
  genre?: string | null;
  tag_list?: string | null;
  created_at?: string | null;
  likes_count?: number | null;
  reposts_count?: number | null;
}

export interface ResolverUser extends ResolverBase {
  type: "user";
  kind: "user";
  username?: string;
  full_name?: string | null;
  description?: string | null;
  followers_count?: number;
  followings_count?: number | null;
  track_count?: number | null;
  playlist_count?: number | null;
  likes_count?: number | null;
  avatar_url?: string;
}

export type ResolverResource = ResolverTrack | ResolverPlaylist | ResolverUser;

export interface ResolveV2Meta {
  version: "2";
  source_url?: string;
  resolved_at?: string;
  cached?: boolean;
  resolver_path?: string;
}

export interface ResolveV2Response {
  data: ResolverResource;
  meta: ResolveV2Meta;
}

export interface BatchResolveRow {
  index: number;
  url: string;
  status: "ok" | "error";
  data?: ResolverResource;
  error?: string;
}

export interface BatchResolveV2Response {
  results: BatchResolveRow[];
  summary: {
    total: number;
    ok: number;
    error: number;
  };
  meta: {
    version: "2";
    resolved_at?: string;
  };
}
