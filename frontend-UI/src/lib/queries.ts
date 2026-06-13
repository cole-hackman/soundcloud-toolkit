"use client";

import { useQuery, type QueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { apiFetchJson } from "@/lib/api";

type QueryOverrides<T> = Omit<
  UseQueryOptions<T, Error, T, readonly unknown[]>,
  "queryKey" | "queryFn"
>;

type CollectionResponse<T> = {
  collection: T[];
  total?: number;
  total_results?: number;
  next_href?: string | null;
};

export interface PlaylistSummary {
  id: number;
  title: string;
  track_count: number;
  artwork_url?: string;
  coverUrl?: string;
}

export interface PlaylistDetail {
  id: number;
  title: string;
  tracks: Array<{ id: number } & Record<string, unknown>>;
}

export interface DashboardSummary {
  followers_count: number;
  followings_count: number;
  likes_count: number;
  playlist_count: number;
}

export const queryKeys = {
  me: () => ["me"] as const,
  dashboardSummary: () => ["dashboard-summary"] as const,
  playlists: () => ["playlists"] as const,
  playlistDetail: (playlistId: number) => ["playlist-detail", playlistId] as const,
  likes: () => ["likes"] as const,
  likesPaged: (cursor: string | null, limit = 50) => ["likes-paged", { cursor, limit }] as const,
  followings: () => ["followings"] as const,
  followers: () => ["followers"] as const,
  reposts: () => ["reposts"] as const,
  activities: (limit = 200) => ["activities", limit] as const,
};

const timings = {
  me: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  dashboardSummary: { staleTime: 60 * 1000, gcTime: 5 * 60 * 1000 },
  playlists: { staleTime: 5 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  playlistDetail: { staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  likes: { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 },
  followings: { staleTime: 5 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  followers: { staleTime: 5 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  reposts: { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 },
  activities: { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 },
};

export function meQueryOptions() {
  return {
    queryKey: queryKeys.me(),
    queryFn: () => apiFetchJson<Record<string, unknown>>("/api/me"),
    ...timings.me,
  };
}

export function dashboardSummaryQueryOptions() {
  return {
    queryKey: queryKeys.dashboardSummary(),
    queryFn: () => apiFetchJson<DashboardSummary>("/api/dashboard/summary"),
    ...timings.dashboardSummary,
  };
}

export function playlistsQueryOptions() {
  return {
    queryKey: queryKeys.playlists(),
    queryFn: () => apiFetchJson<CollectionResponse<PlaylistSummary>>("/api/playlists"),
    ...timings.playlists,
  };
}

export function playlistDetailQueryOptions(playlistId: number) {
  return {
    queryKey: queryKeys.playlistDetail(playlistId),
    queryFn: () => apiFetchJson<PlaylistDetail>(`/api/playlists/${playlistId}`),
    enabled: playlistId > 0,
    ...timings.playlistDetail,
  };
}

export function likesQueryOptions() {
  return {
    queryKey: queryKeys.likes(),
    queryFn: () => apiFetchJson<CollectionResponse<Record<string, unknown>>>("/api/likes"),
    ...timings.likes,
  };
}

export function likesPagedQueryOptions(cursor: string | null, limit = 50) {
  const search = cursor
    ? `/api/likes/paged?next=${encodeURIComponent(cursor)}`
    : `/api/likes/paged?limit=${limit}`;

  return {
    queryKey: queryKeys.likesPaged(cursor, limit),
    queryFn: () => apiFetchJson<CollectionResponse<Record<string, unknown>>>(search),
    ...timings.likes,
  };
}

export function followingsQueryOptions() {
  return {
    queryKey: queryKeys.followings(),
    queryFn: () => apiFetchJson<CollectionResponse<Record<string, unknown>>>("/api/followings"),
    ...timings.followings,
  };
}

export function followersQueryOptions() {
  return {
    queryKey: queryKeys.followers(),
    queryFn: () => apiFetchJson<CollectionResponse<Record<string, unknown>>>("/api/followers"),
    ...timings.followers,
  };
}

export function repostsQueryOptions() {
  return {
    queryKey: queryKeys.reposts(),
    queryFn: () => apiFetchJson<CollectionResponse<Record<string, unknown>>>("/api/reposts"),
    ...timings.reposts,
  };
}

export function activitiesQueryOptions(limit = 200) {
  return {
    queryKey: queryKeys.activities(limit),
    queryFn: () => apiFetchJson<CollectionResponse<Record<string, unknown>>>(`/api/activities?limit=${limit}`),
    ...timings.activities,
  };
}

export function useMeQuery(options?: QueryOverrides<Record<string, unknown>>) {
  return useQuery({ ...meQueryOptions(), ...options });
}

export function useDashboardSummaryQuery(options?: QueryOverrides<DashboardSummary>) {
  return useQuery({ ...dashboardSummaryQueryOptions(), ...options });
}

export function usePlaylistsQuery(options?: QueryOverrides<CollectionResponse<PlaylistSummary>>) {
  return useQuery({ ...playlistsQueryOptions(), ...options });
}

export function usePlaylistDetailQuery(
  playlistId: number,
  options?: QueryOverrides<PlaylistDetail>,
) {
  return useQuery({ ...playlistDetailQueryOptions(playlistId), ...options });
}

export function useLikesQuery(options?: QueryOverrides<CollectionResponse<Record<string, unknown>>>) {
  return useQuery({ ...likesQueryOptions(), ...options });
}

export function useFollowingsQuery(options?: QueryOverrides<CollectionResponse<Record<string, unknown>>>) {
  return useQuery({ ...followingsQueryOptions(), ...options });
}

export function useFollowersQuery(options?: QueryOverrides<CollectionResponse<Record<string, unknown>>>) {
  return useQuery({ ...followersQueryOptions(), ...options });
}

export function useRepostsQuery(options?: QueryOverrides<CollectionResponse<Record<string, unknown>>>) {
  return useQuery({ ...repostsQueryOptions(), ...options });
}

export function useActivitiesQuery(
  limit = 200,
  options?: QueryOverrides<CollectionResponse<Record<string, unknown>>>,
) {
  return useQuery({ ...activitiesQueryOptions(limit), ...options });
}

function getTrackId(item: Record<string, unknown>) {
  const nestedTrack = item.track as { id?: number } | undefined;
  const directId = typeof item.id === "number" ? item.id : undefined;
  return nestedTrack?.id ?? directId;
}

export function removeTracksFromLikesCache(queryClient: QueryClient, removedIds: Set<number>) {
  queryClient.setQueryData<CollectionResponse<Record<string, unknown>>>(queryKeys.likes(), (current) => {
    if (!current) return current;
    const collection = (current.collection || []).filter((item) => {
      const trackId = getTrackId(item);
      return trackId == null || !removedIds.has(trackId);
    });
    return {
      ...current,
      collection,
      total_results:
        typeof current.total_results === "number" ? Math.max(0, current.total_results - removedIds.size) : current.total_results,
      total:
        typeof current.total === "number" ? Math.max(0, current.total - removedIds.size) : current.total,
    };
  });

  const pagedEntries = queryClient.getQueriesData<CollectionResponse<Record<string, unknown>>>({
    queryKey: ["likes-paged"],
  });

  pagedEntries.forEach(([key, value]) => {
    if (!value) return;
    queryClient.setQueryData<CollectionResponse<Record<string, unknown>>>(key, {
      ...value,
      collection: (value.collection || []).filter((item) => {
        const trackId = getTrackId(item);
        return trackId == null || !removedIds.has(trackId);
      }),
    });
  });
}

export function removeUsersFromFollowingsCache(queryClient: QueryClient, removedIds: Set<number>) {
  queryClient.setQueryData<CollectionResponse<Record<string, unknown>>>(queryKeys.followings(), (current) => {
    if (!current) return current;
    const collection = (current.collection || []).filter((item) => !removedIds.has(Number(item.id)));
    return {
      ...current,
      collection,
      total:
        typeof current.total === "number" ? Math.max(0, current.total - removedIds.size) : current.total,
    };
  });
}

export function removeItemsFromRepostsCache(queryClient: QueryClient, removedIds: Set<number>) {
  queryClient.setQueryData<CollectionResponse<Record<string, unknown>>>(queryKeys.reposts(), (current) => {
    if (!current) return current;
    const collection = (current.collection || []).filter((item) => !removedIds.has(Number(item.id)));
    return {
      ...current,
      collection,
      total_results:
        typeof current.total_results === "number" ? Math.max(0, current.total_results - removedIds.size) : current.total_results,
    };
  });
}

export async function invalidatePlaylistCaches(queryClient: QueryClient, playlistId?: number | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary() }),
    playlistId
      ? queryClient.invalidateQueries({ queryKey: queryKeys.playlistDetail(playlistId) })
      : queryClient.invalidateQueries({ queryKey: ["playlist-detail"] }),
  ]);
}

export async function invalidateDashboardSummary(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary() });
}
