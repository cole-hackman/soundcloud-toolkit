/**
 * Shapes returned by server/routes/admin.js. Keep these in step with the
 * route handlers — the console renders exactly these fields and nothing else.
 */

export type Period = "1d" | "7d" | "30d" | "90d" | "month" | "all";

export const PERIODS: ReadonlyArray<{ value: Period; label: string; long: string }> = [
  { value: "1d", label: "24h", long: "last 24 hours" },
  { value: "7d", label: "7d", long: "last 7 days" },
  { value: "30d", label: "30d", long: "last 30 days" },
  { value: "90d", label: "90d", long: "last 90 days" },
  { value: "month", label: "MTD", long: "month to date" },
  { value: "all", label: "All", long: "all time" },
];

export type OpStatus = "success" | "split" | "error" | "partial";
export const OP_STATUSES: ReadonlyArray<OpStatus> = ["success", "split", "error", "partial"];

export interface FeatureUsage {
  key: string;
  name: string;
  count: number;
  avgDurationMs: number;
  errorCount: number;
  errorRate: number;
  color: string;
}

export interface FeatureReach {
  key: string;
  name: string;
  users: number;
  opens: number;
}

export interface ErrorBucket {
  errorCode: string;
  count: number;
}

export interface LatencyRow {
  action: string;
  name: string;
  runs: number;
  p95Ms: number;
  avgMs: number;
  maxMs: number;
  avgScCalls: number | null;
}

export interface AnalyticsWriteHealth {
  failures: number;
  lastWriteAt?: string | null;
  lastFailureAt?: string | null;
  lastFailureMessage?: string | null;
}

export interface AdminStats {
  totalUsers: number;
  newUsers: number;
  tracksProcessed: number;
  operationsCount: number;
  featureUsage: FeatureUsage[];
  featureReach: FeatureReach[];
  errorBreakdown: ErrorBucket[];
  errorRateByAction: FeatureUsage[];
  splitsCount: number;
  avgTracksPerOp: number;
  avgDurationMs: number;
  p95DurationMs: number;
  successRate: number;
  splitRate: number;
  errorRate: number;
  partialRate: number;
  partialCount: number;
  topFeature: FeatureUsage | null;
  readLatency: LatencyRow[];
  activeUsersPeriod: number;
  analyticsWriteHealth: AnalyticsWriteHealth;
}

export interface DailyPoint {
  date: string;
  tracks: number;
  operations: number;
  newUsers: number;
}

export interface OperationUser {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  soundcloudId: number | null;
}

export interface ClientInfo {
  device?: string;
  browser?: string;
  platform?: string;
  [key: string]: unknown;
}

export interface OperationRow {
  id: string;
  user: OperationUser;
  soundcloudId: number | null;
  action: string;
  actionName: string;
  trackCount: number;
  itemCount: number;
  status: OpStatus | string;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  clientInfo: ClientInfo | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface OperationsFilter {
  status: OpStatus | "all";
  action: string;
  search: string;
  limit: 50 | 100;
}

export const DEFAULT_OPS_FILTER: OperationsFilter = {
  status: "all",
  action: "",
  search: "",
  limit: 50,
};

export interface CatalogSummary {
  period: Period;
  totalTracks: number;
  totalArtists: number;
  totalPlaylists: number;
  accessBreakdown: Record<string, number>;
  resolveBreakdown: Record<string, number>;
  genreBreakdown: Array<{ genre: string; count: number }>;
  periodTouchEvents: number;
  periodDistinctTracks: number;
}

export interface CatalogTrack {
  id: number | string;
  title: string | null;
  artistName: string | null;
  artistId: number | string | null;
  genre: string | null;
  genreNormalized: string | null;
  durationMs: number | null;
  access: string | null;
  permalinkUrl: string | null;
  resolveStatus: string;
  resolveAttempts: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  touches: number;
  users: number;
  last_touched: string | null;
}

export interface CatalogTracksResponse {
  tracks: CatalogTrack[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  order: "asc" | "desc";
}

export type CatalogSort = "touches" | "users" | "lastTouched" | "title" | "artist";

export interface CatalogFilter {
  genre: string;
  artist: string;
  access: string;
  resolveStatus: string;
  action: string;
  sort: CatalogSort;
  order: "asc" | "desc";
  page: number;
}

export const DEFAULT_CATALOG_FILTER: CatalogFilter = {
  genre: "",
  artist: "",
  access: "",
  resolveStatus: "",
  action: "",
  sort: "touches",
  order: "desc",
  page: 1,
};

export interface TrackOperation {
  id: string;
  action: string;
  actionName: string;
  status: OpStatus | string;
  createdAt: string;
  user: { username: string; displayName: string | null; soundcloudId: number };
}

export interface RebrandSummary {
  period: Period;
  campaignId: string | null;
  total: number;
  nameChoice: Record<string, number>;
  nameIdeaCount: number;
  featureIdeaCount: number;
}

export interface RebrandVote {
  id: string;
  user: { username: string; displayName: string | null; avatarUrl: string | null };
  soundcloudId: number | null;
  campaignId: string;
  nameChoice: string;
  nameIdea: string | null;
  featureIdea: string | null;
  context: string | null;
  createdAt: string;
}

export interface BetaSurveySummary {
  period: Period;
  campaignId: string | null;
  total: number;
  wantsBetaCount: number;
  interest: Record<string, number>;
  rekordboxUse: Record<string, number>;
  platform: Record<string, number>;
}

export type View = "overview" | "operations" | "performance" | "catalog" | "archive";

export const VIEWS: ReadonlyArray<{ id: View; label: string; hint: string }> = [
  { id: "overview", label: "Overview", hint: "Health, growth and what people use" },
  { id: "operations", label: "Operations", hint: "Every logged operation, searchable" },
  { id: "performance", label: "Performance", hint: "Latency by action, p95 first" },
  { id: "catalog", label: "Catalog", hint: "The harvested track catalog" },
  { id: "archive", label: "Archive", hint: "Closed votes and retired surveys" },
];
