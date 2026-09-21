"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  AdminStats,
  BetaSurveySummary,
  CatalogFilter,
  CatalogSummary,
  CatalogTracksResponse,
  DailyPoint,
  OperationRow,
  OperationsFilter,
  Period,
  RebrandSummary,
  RebrandVote,
  TrackOperation,
} from "./types";

/** How often a live view re-polls. Polling pauses while the tab is hidden. */
export const POLL_MS = 30_000;

export class AdminHttpError extends Error {
  status: number;
  constructor(status: number, message?: string) {
    super(message ?? `Request failed (${status})`);
    this.name = "AdminHttpError";
    this.status = status;
  }
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    let message: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      /* body was not JSON */
    }
    throw new AdminHttpError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const live = {
  refetchInterval: POLL_MS,
  refetchIntervalInBackground: false,
  placeholderData: keepPreviousData,
  staleTime: 10_000,
} as const;

export const adminKeys = {
  stats: (period: Period) => ["admin", "stats", period] as const,
  daily: (period: Period) => ["admin", "daily", period] as const,
  operations: (period: Period, filter: OperationsFilter) =>
    ["admin", "operations", period, filter] as const,
  catalogSummary: (period: Period) => ["admin", "catalog", "summary", period] as const,
  catalogTracks: (period: Period, filter: CatalogFilter) =>
    ["admin", "catalog", "tracks", period, filter] as const,
  trackOperations: (trackId: string) => ["admin", "catalog", "track-ops", trackId] as const,
  rebrandSummary: () => ["admin", "rebrand", "summary"] as const,
  rebrandVotes: () => ["admin", "rebrand", "votes"] as const,
  betaSurvey: () => ["admin", "feedback", "summary"] as const,
};

export function useAdminStats(period: Period, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.stats(period),
    queryFn: () => adminGet<AdminStats>(`/api/admin/stats?period=${period}`),
    enabled,
    ...live,
  });
}

export function useAdminDaily(period: Period, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.daily(period),
    queryFn: async () => {
      const data = await adminGet<{ daily: DailyPoint[] }>(`/api/admin/daily?period=${period}`);
      return data.daily ?? [];
    },
    enabled,
    ...live,
  });
}

export function useAdminOperations(period: Period, filter: OperationsFilter, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.operations(period, filter),
    queryFn: async () => {
      const params = new URLSearchParams({ period, limit: String(filter.limit) });
      if (filter.status !== "all") params.set("status", filter.status);
      if (filter.action) params.set("action", filter.action);
      if (filter.search.trim()) params.set("search", filter.search.trim());
      const data = await adminGet<{ operations: OperationRow[] }>(
        `/api/admin/operations?${params.toString()}`,
      );
      return data.operations ?? [];
    },
    enabled,
    ...live,
  });
}

export function useCatalogSummary(period: Period, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.catalogSummary(period),
    queryFn: () => adminGet<CatalogSummary>(`/api/admin/catalog/summary?period=${period}`),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export const CATALOG_PAGE_SIZE = 25;

export function useCatalogTracks(period: Period, filter: CatalogFilter, enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.catalogTracks(period, filter),
    queryFn: () => {
      const params = new URLSearchParams({
        period,
        page: String(filter.page),
        pageSize: String(CATALOG_PAGE_SIZE),
        sort: filter.sort,
        order: filter.order,
      });
      if (filter.genre) params.set("genre", filter.genre);
      if (filter.artist) params.set("artist", filter.artist);
      if (filter.access) params.set("access", filter.access);
      if (filter.resolveStatus) params.set("resolveStatus", filter.resolveStatus);
      if (filter.action) params.set("action", filter.action);
      return adminGet<CatalogTracksResponse>(`/api/admin/catalog/tracks?${params.toString()}`);
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useTrackOperations(trackId: string | null) {
  return useQuery({
    queryKey: adminKeys.trackOperations(trackId ?? ""),
    queryFn: async () => {
      const data = await adminGet<{ operations: TrackOperation[] }>(
        `/api/admin/catalog/tracks/${encodeURIComponent(trackId ?? "")}/operations`,
      );
      return data.operations ?? [];
    },
    enabled: trackId != null,
    staleTime: 5 * 60_000,
  });
}

// The vote is closed, so these are read once and never polled. They are
// always all-time: a period filter on a finished vote only produces an empty,
// misleading "no votes in this window".
export function useRebrandSummary(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.rebrandSummary(),
    queryFn: () => adminGet<RebrandSummary>("/api/admin/rebrand/summary?period=all"),
    enabled,
    staleTime: Infinity,
  });
}

export function useRebrandVotes(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.rebrandVotes(),
    queryFn: async () => {
      const data = await adminGet<{ responses: RebrandVote[] }>(
        "/api/admin/rebrand?period=all&limit=200",
      );
      return data.responses ?? [];
    },
    enabled,
    staleTime: Infinity,
  });
}

export function useBetaSurveySummary(enabled: boolean) {
  return useQuery({
    queryKey: adminKeys.betaSurvey(),
    queryFn: () => adminGet<BetaSurveySummary>("/api/admin/feedback/summary?period=all"),
    enabled,
    staleTime: Infinity,
  });
}
