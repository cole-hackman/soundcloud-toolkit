"use client";

/**
 * Progressive (page-at-a-time) loading for the browse tools.
 *
 * The full-library endpoints crawl SoundCloud page by page on the server —
 * a 5,000-like library is 25 sequential round trips before the response
 * starts. These hooks page the same data 200 items at a time so the first
 * rows paint after one round trip and the rest fills in behind them.
 *
 * The hard part is not the fetching, it is not lying about it. Anything
 * derived from a partially-loaded collection (a count, a search result, a
 * "select all") must say what it is actually derived from — see
 * `ProgressiveState.isComplete` and the copy helpers at the bottom.
 */
import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery, type QueryClient } from "@tanstack/react-query";
import { apiFetchJson } from "@/lib/api";

/** SoundCloud's maximum page size. Also the snapshot page size server-side,
 *  so a page request maps to exactly one stored row. */
export const PAGE_SIZE = 200;

type CursorPage<T> = {
  collection: T[];
  next_href?: string | null;
  total?: number;
};

type OffsetPage<T> = {
  collection: T[];
  total?: number;
  offset?: number;
  limit?: number;
  has_more?: boolean;
};

export const progressiveKeys = {
  likes: () => ["progressive", "likes"] as const,
  followings: () => ["progressive", "followings"] as const,
  followers: () => ["progressive", "followers"] as const,
  reposts: () => ["progressive", "reposts"] as const,
};

/* ── Cursor-paged resources (likes, followings, followers) ──────────────── */

function cursorPagedOptions<T>(path: string, queryKey: readonly unknown[]) {
  return {
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiFetchJson<CursorPage<T>>(
        pageParam
          ? `${path}?next=${encodeURIComponent(pageParam)}`
          : `${path}?limit=${PAGE_SIZE}`,
      ),
    getNextPageParam: (last: CursorPage<T>) => last.next_href ?? undefined,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  };
}

/* ── Offset-paged resources (reposts) ───────────────────────────────────── */

function offsetPagedOptions<T>(path: string, queryKey: readonly unknown[]) {
  return {
    queryKey,
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      apiFetchJson<OffsetPage<T>>(`${path}?limit=${PAGE_SIZE}&offset=${pageParam}`),
    getNextPageParam: (last: OffsetPage<T>, all: OffsetPage<T>[]) => {
      if (!last.has_more) return undefined;
      return all.reduce((n, p) => n + (p.collection?.length ?? 0), 0);
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  };
}

export interface ProgressiveState<T> {
  /** Everything loaded so far, in order. */
  items: T[];
  /** How many items are loaded. */
  loadedCount: number;
  /**
   * The size of the whole collection, when the server told us. `null` means
   * genuinely unknown — SoundCloud does not always return a total — and the
   * UI must not invent one.
   */
  totalCount: number | null;
  /** True once every page has been fetched. Only then do counts, search
   *  results and "select all" cover the whole library. */
  isComplete: boolean;
  /** First page still in flight — nothing to show yet. */
  isLoadingFirstPage: boolean;
  /** A later page is in flight; rows are already on screen. */
  isLoadingMore: boolean;
  error: Error | null;
  /** Fetch the remaining pages and resolve once complete. For the paths where
   *  operating on a partial set would silently produce a wrong result. */
  ensureComplete: () => Promise<void>;
  refetch: () => Promise<unknown>;
}

function useProgressive<T>(
  options: ReturnType<typeof cursorPagedOptions<T>> | ReturnType<typeof offsetPagedOptions<T>>,
  { enabled = true, autoLoadAll = true }: { enabled?: boolean; autoLoadAll?: boolean } = {},
): ProgressiveState<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = useInfiniteQuery({ ...(options as any), enabled });

  const pages = useMemo(
    () => (query.data?.pages ?? []) as Array<CursorPage<T> | OffsetPage<T>>,
    [query.data],
  );

  const items = useMemo(
    () => pages.flatMap((p) => p.collection ?? []),
    [pages],
  );

  const totalCount = useMemo(() => {
    const reported = pages.find((p) => typeof p.total === "number")?.total;
    return typeof reported === "number" ? reported : null;
  }, [pages]);

  const isComplete = Boolean(query.data) && !query.hasNextPage && !query.isFetchingNextPage;

  // Keep pulling pages in the background so the list fills in on its own.
  // Guarded on isFetchingNextPage so this fires one page at a time rather
  // than stacking requests.
  useEffect(() => {
    if (!autoLoadAll || !enabled) return;
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
      void query.fetchNextPage();
    }
  }, [autoLoadAll, enabled, query.hasNextPage, query.isFetchingNextPage, query.isError, query]);

  const ensureComplete = useCallback(async () => {
    // Sequential by necessity: the next cursor only exists once the previous
    // page has come back.
    let guard = 0;
    while (query.hasNextPage && guard < 500) {
      await query.fetchNextPage();
      guard += 1;
    }
  }, [query]);

  return {
    items,
    loadedCount: items.length,
    totalCount,
    isComplete,
    isLoadingFirstPage: query.isPending,
    isLoadingMore: query.isFetchingNextPage,
    error: (query.error as Error) ?? null,
    ensureComplete,
    refetch: query.refetch,
  };
}

export function useProgressiveLikes<T = Record<string, unknown>>(opts?: { enabled?: boolean }) {
  return useProgressive<T>(
    cursorPagedOptions<T>("/api/likes/paged", progressiveKeys.likes()),
    opts,
  );
}

export function useProgressiveFollowings<T = Record<string, unknown>>(opts?: { enabled?: boolean }) {
  return useProgressive<T>(
    cursorPagedOptions<T>("/api/followings/paged", progressiveKeys.followings()),
    opts,
  );
}

export function useProgressiveFollowers<T = Record<string, unknown>>(opts?: { enabled?: boolean }) {
  return useProgressive<T>(
    cursorPagedOptions<T>("/api/followers/paged", progressiveKeys.followers()),
    opts,
  );
}

export function useProgressiveReposts<T = Record<string, unknown>>(opts?: { enabled?: boolean }) {
  return useProgressive<T>(
    offsetPagedOptions<T>("/api/reposts/paged", progressiveKeys.reposts()),
    opts,
  );
}

/* ── Honest copy ────────────────────────────────────────────────────────── */

/**
 * Status line for a list that may still be loading.
 *
 * Never implies completeness it does not have: while loading it says so, and
 * it only prints "of N" when the server actually reported a total.
 */
export function progressiveStatus(
  state: Pick<ProgressiveState<unknown>, "loadedCount" | "totalCount" | "isComplete">,
  noun: string,
  { filteredCount }: { filteredCount?: number } = {},
): string | null {
  const { loadedCount, totalCount, isComplete } = state;
  if (isComplete) {
    // Complete: the plain count is the truth, so say nothing extra.
    return filteredCount != null && filteredCount !== loadedCount
      ? `${filteredCount.toLocaleString()} of ${loadedCount.toLocaleString()} ${noun}`
      : null;
  }
  const loaded = loadedCount.toLocaleString();
  const scope = filteredCount != null
    ? `Matching ${filteredCount.toLocaleString()} of ${loaded} loaded`
    : `Showing ${loaded}`;
  return totalCount != null
    ? `${scope} of ${totalCount.toLocaleString()} — still loading…`
    : `${scope} ${noun} — still loading…`;
}

/** Label for a select-all control, carrying what it will actually select. */
export function selectAllLabel(
  state: Pick<ProgressiveState<unknown>, "isComplete">,
  count: number,
): string {
  return state.isComplete
    ? `Select all ${count.toLocaleString()}`
    : `Select all ${count.toLocaleString()} loaded`;
}

/** Drop every progressive cache for a resource after a mutation. */
export async function invalidateProgressive(
  queryClient: QueryClient,
  resource: keyof typeof progressiveKeys,
) {
  await queryClient.invalidateQueries({ queryKey: progressiveKeys[resource]() });
}
