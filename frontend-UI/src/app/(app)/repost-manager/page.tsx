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
} from "lucide-react";
import {
  BulkReviewDetails,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  PageContainer,
  PageHeader,
  ProgressBar,
  SectionHeading,
  Select,
  SelectableRow,
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
  const [removeProgress, setRemoveProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
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

      setRemoveProgress({ current: 0, total: items.length });

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

        setRemoveProgress({
          current: Math.min(i + CHUNK, items.length),
          total: items.length,
        });
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
      setRemoveProgress(null);
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
    <PageContainer maxWidth="wide" className="pb-28">
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

        {removing && removeProgress && (
          <ProgressBar
            className="mb-6 rounded-lg border-2 border-border bg-secondary/10 p-4"
            label="Removing reposts"
            value={removeProgress.current}
            max={removeProgress.total}
          />
        )}

        {!loading && reposts.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<Repeat2 className="w-12 h-12" />}
              title="No reposts found"
              description="You haven't reposted any tracks or playlists recently."
            />
          </Card>
        ) : (
          <Card className="p-6">
            <SectionHeading className="mb-3">Reposts</SectionHeading>

            {/* Controls — stay interactive while the list is still loading */}
            <div className="grid grid-cols-1 gap-2 mb-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <Field
                label="Search reposts"
                className="lg:min-w-[200px] lg:flex-1 [&>label]:sr-only"
              >
                {(field) => (
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground-subtle"
                    />
                    <Input
                      {...field}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search reposts..."
                      className="h-11 pl-10 bg-gray-50 dark:bg-secondary/20"
                    />
                  </div>
                )}
              </Field>
              {/* The brief called this one "Type"; its options are Most
                  Recent / Oldest / A → Z, so "Sort" is what it actually does
                  and what a screen reader should say. */}
              <Select
                label="Sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-gray-50 dark:bg-secondary/20"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">A → Z</option>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={loading}
                className="whitespace-nowrap text-primary-text"
              >
                {selected.size === filteredReposts.length
                  ? "Deselect All"
                  : selectAllLabel(repostsState, filteredReposts.length)}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAutoSelect((v) => !v)}
                disabled={loading}
                aria-expanded={showAutoSelect}
                className="whitespace-nowrap text-muted-foreground"
              >
                {showAutoSelect ? "Hide auto-select" : "Auto-select…"}
              </Button>
            </div>

            {/* Auto-select with a keep-list (everything except matches gets selected) */}
            {showAutoSelect && !loading && (
              <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-gray-200 dark:border-border">
                <SectionHeading as="h3" className="mb-1">
                  Auto-select everything except your keep-list
                </SectionHeading>
                <p className="text-xs text-muted-foreground mb-3">
                  One artist or title per line (or comma-separated). Matches are kept; everything
                  else in the current view is selected. Wrap a line in <code>/slashes/</code> for regex.
                  Nothing is removed until you confirm.
                </p>
                {/* The brief's label for this box was "Track or playlist URLs,
                    one per line" — that is another page's control. This one
                    takes artist/title patterns to KEEP, and mislabelling it
                    would be worse than the missing label was. */}
                <Field label="Keep-list — one artist or title per line" className="mb-3">
                  {(field) => (
                    <textarea
                      {...field}
                      value={keepList}
                      onChange={(e) => setKeepList(e.target.value)}
                      placeholder={"Phibes\nMyFavoriteArtist\n/remix$/"}
                      rows={3}
                      className="w-full px-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-base sm:text-sm font-mono text-foreground bg-white dark:bg-secondary/20 focus:border-primary focus:outline-none resize-y"
                    />
                  )}
                </Field>
                <div className="flex items-end gap-3 flex-wrap">
                  <Field label="Limit">
                    {(field) => (
                      <Input
                        {...field}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={limitInput}
                        onChange={(e) => setLimitInput(e.target.value)}
                        placeholder="all"
                        className="h-11 w-24 bg-white dark:bg-secondary/20"
                      />
                    )}
                  </Field>
                  <Button size="sm" onClick={selectExceptKeepList}>
                    Select {Math.min(removableReposts.length, parsedLimit === Infinity ? removableReposts.length : parsedLimit)} to remove
                  </Button>
                  <p role="status" className="text-xs text-muted-foreground-subtle">
                    {keptCount} kept · {removableReposts.length} removable in view
                    {!repostsState.isComplete && " (more still loading)"}
                  </p>
                </div>
              </div>
            )}

            {!loading && repostsStatus && (
              <p role="status" className="text-sm text-muted-foreground-subtle mb-2">
                {repostsStatus}
              </p>
            )}

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : (
            <div ref={listScrollRef} className="max-h-[60dvh] overflow-y-auto">
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
                      <SelectableRow
                        as="div"
                        id={repost.id}
                        selected={isSelected}
                        // Track or playlist is part of what the row IS, so it
                        // belongs in the checkbox's name — without it a
                        // screen-reader user tabbing the list cannot tell a
                        // reposted playlist from a reposted track.
                        label={`${repost.title} (${repost.resourceType})`}
                        onToggle={(e) => toggleItem(repost.id, index, filteredReposts, e)}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {/* Artwork */}
                          {repost.artwork_url ? (
                            <img
                              src={repost.artwork_url}
                              alt=""
                              width={40}
                              height={40}
                              loading="lazy"
                              decoding="async"
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-secondary flex items-center justify-center shrink-0">
                              {repost.resourceType === "playlist" ? (
                                <ListMusic aria-hidden="true" className="w-5 h-5 text-muted-foreground-subtle" />
                              ) : (
                                <Music aria-hidden="true" className="w-5 h-5 text-muted-foreground-subtle" />
                              )}
                            </span>
                          )}

                          {/* Info */}
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-foreground text-sm truncate">
                              {repost.title}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate">
                              {repost.user?.username}
                            </span>
                          </span>

                          {/* Inside the toggle, not `rightSlot`: it is a label
                              for the row, not a control. One neutral chip for
                              both kinds — the track badge used to be orange
                              text on an orange-100 chip, below 4.5:1. */}
                          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-semibold uppercase tracking-wide text-foreground">
                            {repost.resourceType}
                          </span>
                        </span>
                      </SelectableRow>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {!loading && repostsState.isLoadingMore && (
              <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground-subtle">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </div>
            )}
          </Card>
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
