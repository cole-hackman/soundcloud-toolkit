"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Repeat2,
  Music,
  ListMusic,
  Search,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import {
  BulkReviewDetails,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  SelectionBanner,
  Skeleton,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { removeItemsFromRepostsCache } from "@/lib/queries";
import { useProgressiveReposts, progressiveStatus, selectAllLabel } from "@/lib/progressive";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Repost {
  id: number;
  urn: string;
  resourceType: "track" | "playlist";
  title: string;
  user: { username: string };
  artwork_url: string | null;
  permalink_url: string | null;
  created_at: string | null;
}

type SortOption = "recent" | "oldest" | "alpha";


// Module scope: this closes over nothing, so defining it per render only made
// it a changing dependency of the memos below.
function matchesKeepList(
  r: Repost,
  matchers: (RegExp | { test: (s: string) => boolean })[],
) {
  const haystack = `${r.title} ${r.user?.username ?? ""}`;
  return matchers.some((m) => m.test(haystack));
}

export default function RepostManagerPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [keepList, setKeepList] = useState("");
  const [limitInput, setLimitInput] = useState("");
  const [showAutoSelect, setShowAutoSelect] = useState(false);

  const repostsState = useProgressiveReposts<Repost>();
  const reposts = repostsState.items;
  const loading = repostsState.isLoadingFirstPage;

  useEffect(() => {
    if (repostsState.error) {
      setNotice({ type: "error", text: "Couldn’t load your reposts. Try refreshing the page." });
    }
  }, [repostsState.error]);

  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const toggleItem = (id: number, index: number, currentFilteredReposts: Repost[], event?: React.MouseEvent | React.KeyboardEvent) => {
    const isShiftKey = event && 'shiftKey' in event && event.shiftKey;

    if (isShiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(currentFilteredReposts[i].id);
        }
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastSelectedIndex(index);
    }
  };

  const selectAll = () => {
    if (selected.size === filteredReposts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredReposts.map((r) => r.id)));
    }
  };

  const handleBulkRemove = async () => {
    if (selected.size === 0) return;
    setShowRemoveConfirm(true);
  };

  const executeBulkRemove = async () => {
    setShowRemoveConfirm(false);
    setRemoving(true);
    setNotice(null);
    try {
      const items = reposts
        .filter((r) => selected.has(r.id))
        .map((r) => ({ id: r.id, resourceType: r.resourceType }));

      // The API caps each request at 100 items, so chunk larger selections.
      const CHUNK = 100;
      const removedIds = new Set<number>();
      let rateLimited = false;

      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        const response = await apiFetch("/api/reposts/bulk-remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk }),
        });

        if (response.status === 429) {
          rateLimited = true;
          break;
        }
        if (!response.ok) break;

        const data = await response.json();
        for (const r of data.results as { id: number; status: string }[]) {
          if (r.status === "ok") removedIds.add(r.id);
        }
      }

      removeItemsFromRepostsCache(queryClient, removedIds);
      setSelected((prev) => {
        const next = new Set(prev);
        removedIds.forEach((id) => next.delete(id));
        return next;
      });

      if (removedIds.size === items.length) {
        setNotice({ type: "success", text: `Removed ${removedIds.size} repost${removedIds.size === 1 ? "" : "s"}.` });
      } else if (rateLimited) {
        setNotice({
          type: "error",
          text: `Removed ${removedIds.size} of ${items.length} before hitting SoundCloud's rate limit. Wait a bit and run it again to finish.`,
        });
      } else {
        setNotice({
          type: "error",
          text: `Removed ${removedIds.size} of ${items.length} reposts. Some failed — try again.`,
        });
      }
    } catch (error) {
      console.error("Bulk remove error:", error);
      setNotice({ type: "error", text: "An error occurred while removing reposts." });
    } finally {
      setRemoving(false);
    }
  };

  const debouncedSearch = useDebouncedValue(search, 150);
  const debouncedKeepList = useDebouncedValue(keepList, 150);

  const filteredReposts = useMemo(() => {
    const query = debouncedSearch.toLowerCase();

    // Precompute each repost's sort timestamp once instead of parsing
    // `created_at` into a Date twice per comparison inside .sort().
    const withSortKey = reposts
      .filter(
        (r) =>
          !query ||
          r.title.toLowerCase().includes(query) ||
          r.user?.username?.toLowerCase().includes(query)
      )
      .map((r) => ({
        repost: r,
        createdAtMs: r.created_at ? new Date(r.created_at).getTime() : 0,
      }));

    withSortKey.sort((a, b) => {
      if (sort === "alpha") return a.repost.title.localeCompare(b.repost.title);
      if (sort === "oldest") return a.createdAtMs - b.createdAtMs;
      return b.createdAtMs - a.createdAtMs;
    });

    return withSortKey.map((entry) => entry.repost);
  }, [reposts, debouncedSearch, sort]);

  // Build a matcher for each keep-list entry. Lines wrapped in /slashes/ are
  // treated as regex; everything else is a case-insensitive substring match.
  // Matched against both the title and the uploader's username. Recompiling
  // a RegExp per line is only worth doing once the keep-list stops changing.
  const keepMatchers = useMemo(
    () =>
      debouncedKeepList
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((entry) => {
          const rx = entry.match(/^\/(.*)\/([a-z]*)$/i);
          if (rx) {
            try {
              return new RegExp(rx[1], rx[2].includes("i") ? rx[2] : rx[2] + "i");
            } catch {
              /* fall through to substring on invalid regex */
            }
          }
          const lower = entry.toLowerCase();
          return { test: (s: string) => s.toLowerCase().includes(lower) } as RegExp;
        }),
    [debouncedKeepList],
  );

  // Reposts in the current (search-filtered) view that are NOT protected by the keep-list.
  const removableReposts = useMemo(
    () => filteredReposts.filter((r) => !matchesKeepList(r, keepMatchers)),
    [filteredReposts, keepMatchers],
  );
  const keptCount = filteredReposts.length - removableReposts.length;
  const parsedLimit = (() => {
    const n = parseInt(limitInput, 10);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
  })();

  const selectExceptKeepList = () => {
    const targets = removableReposts.slice(0, parsedLimit === Infinity ? undefined : parsedLimit);
    setSelected(new Set(targets.map((r) => r.id)));
  };

  // Virtualize the list — only rows scrolled into view get mounted.
  // `virtualRow.index` is the row's index into `filteredReposts` itself
  // (react-virtual indexes by full-list position, not visible window), so
  // it's exactly the index shift-click range-selection needs.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredReposts.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 72, // ~64px row + 8px gap
    overscan: 8,
  });

  // Only computed while the confirm dialog is open — no point building this
  // on every render while it's closed.
  const removeReviewItems = useMemo(() => {
    if (!showRemoveConfirm) return [];
    return reposts
      .filter((repost) => selected.has(repost.id))
      .map((repost) => ({
        id: repost.id,
        label: repost.title,
        meta: `${repost.resourceType} by ${repost.user?.username || "Unknown"}`,
      }));
  }, [reposts, selected, showRemoveConfirm]);

  const hasActiveFilter = Boolean(debouncedSearch);
  const repostsStatus = progressiveStatus(
    repostsState,
    "reposts",
    hasActiveFilter ? { filteredCount: filteredReposts.length } : {},
  );

  return (
    <PageContainer maxWidth="wide" className={selected.size > 0 ? "pb-28" : ""}>
        <PageHeader
          title="Repost Manager"
          description="Browse, search, and manage your reposted tracks and playlists. Remove in bulk."
        />

        {/* Info notice about activity-feed limitation */}
        <InlineAlert variant="info" className="mb-6">
          Reposts are loaded from your recent SoundCloud activity feed. Very old reposts
          may not appear here due to API limitations.
        </InlineAlert>

        {notice && (
          <InlineAlert
            variant={notice.type}
            className="mb-6"
            onDismiss={() => setNotice(null)}
          >
            {notice.text}
          </InlineAlert>
        )}

        {!loading && reposts.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border">
            <EmptyState
              icon={<Repeat2 className="w-12 h-12" />}
              title="No reposts found"
              description="You haven't reposted any tracks or playlists recently."
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            {/* Controls — stay interactive while the list is still loading */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search reposts..."
                  className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-primary focus:outline-none"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="px-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-primary focus:outline-none"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">A → Z</option>
              </select>
              <button
                onClick={selectAll}
                disabled={loading}
                className="text-sm text-primary hover:text-primary font-medium whitespace-nowrap disabled:opacity-50"
              >
                {selected.size === filteredReposts.length
                  ? "Deselect All"
                  : selectAllLabel(repostsState, filteredReposts.length)}
              </button>
              <button
                onClick={() => setShowAutoSelect((v) => !v)}
                disabled={loading}
                className="text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground font-medium whitespace-nowrap disabled:opacity-50"
              >
                {showAutoSelect ? "Hide auto-select" : "Auto-select…"}
              </button>
            </div>

            {/* Auto-select with a keep-list (everything except matches gets selected) */}
            {showAutoSelect && !loading && (
              <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-gray-200 dark:border-border">
                <div className="text-sm font-semibold text-foreground mb-1">
                  Auto-select everything except your keep-list
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  One artist or title per line (or comma-separated). Matches are kept; everything
                  else in the current view is selected. Wrap a line in <code>/slashes/</code> for regex.
                  Nothing is removed until you confirm.
                </p>
                <textarea
                  value={keepList}
                  onChange={(e) => setKeepList(e.target.value)}
                  placeholder={"Phibes\nMyFavoriteArtist\n/remix$/"}
                  rows={3}
                  className="w-full px-3 py-2 mb-3 border-2 border-gray-200 dark:border-border rounded-lg text-sm font-mono text-foreground bg-white dark:bg-secondary/20 focus:border-primary focus:outline-none resize-y"
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-muted-foreground flex items-center gap-2">
                    Limit
                    <input
                      type="number"
                      min={1}
                      value={limitInput}
                      onChange={(e) => setLimitInput(e.target.value)}
                      placeholder="all"
                      className="w-20 px-2 py-1 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-foreground bg-white dark:bg-secondary/20 focus:border-primary focus:outline-none"
                    />
                  </label>
                  <button
                    onClick={selectExceptKeepList}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium"
                  >
                    Select {Math.min(removableReposts.length, parsedLimit === Infinity ? removableReposts.length : parsedLimit)} to remove
                  </button>
                  <span className="text-xs text-muted-foreground/70">
                    {keptCount} kept · {removableReposts.length} removable in view
                    {!repostsState.isComplete && " (more still loading)"}
                  </span>
                </div>
              </div>
            )}

            {!loading && repostsStatus && (
              <div className="text-sm text-muted-foreground/70 mb-2">{repostsStatus}</div>
            )}

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : (
            <div ref={listScrollRef} className="max-h-[600px] overflow-y-auto">
              <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const repost = filteredReposts[virtualRow.index];
                  const index = virtualRow.index;
                  const isSelected = selected.has(repost.id);
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      className="pb-2"
                    >
                      <button
                        onClick={(e) => toggleItem(repost.id, index, filteredReposts, e)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                          isSelected
                            ? "bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-900/30"
                            : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                        }`}
                      >
                        {/* Checkbox indicator */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-red-500 text-white"
                              : "bg-gray-200 dark:bg-secondary"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>

                        {/* Artwork */}
                        {repost.artwork_url ? (
                          <img
                            src={repost.artwork_url}
                            alt={repost.title}
                            width={40}
                            height={40}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-secondary flex items-center justify-center flex-shrink-0">
                            {repost.resourceType === "playlist" ? (
                              <ListMusic className="w-5 h-5 text-muted-foreground/70" />
                            ) : (
                              <Music className="w-5 h-5 text-muted-foreground/70" />
                            )}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground text-sm truncate">
                            {repost.title}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {repost.user?.username}
                          </div>
                        </div>

                        {/* Type badge */}
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${
                            repost.resourceType === "playlist"
                              ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                              : "bg-orange-100 dark:bg-orange-900/20 text-primary"
                          }`}
                        >
                          {repost.resourceType}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {!loading && repostsState.isLoadingMore && (
              <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground/70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </div>
            )}
          </div>
        )}
      <SelectionBanner
        count={selected.size}
        entityName="repost"
        actionLabel="Remove Reposts"
        actionVariant="destructive"
        onAction={handleBulkRemove}
        disabled={removing}
        actionIcon={removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      />
      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove selected reposts?"
        description={`Remove ${selected.size} repost${selected.size === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={executeBulkRemove}
        onCancel={() => setShowRemoveConfirm(false)}
      >
        <BulkReviewDetails
          action="removing reposts"
          warning="Removed reposts are no longer visible on your profile. Export the selection if you need a record."
          exportFilename="reposts-to-remove.csv"
          items={removeReviewItems}
        />
      </ConfirmDialog>
    </PageContainer>
  );
}
