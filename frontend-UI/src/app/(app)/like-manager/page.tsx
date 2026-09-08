"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Heart, Search, Trash2, Loader2 } from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  BulkReviewDetails,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  SelectionBanner,
  Skeleton,
  TrackRow,
  Card,
  Input,
  Button
} from "@/components/ui";
import { ProgressiveBlur } from "@/components/ui/ProgressiveBlur";
import { apiFetch } from "@/lib/api";
import { invalidateDashboardSummary, removeTracksFromLikesCache } from "@/lib/queries";
import { useProgressiveLikes, progressiveStatus, selectAllLabel } from "@/lib/progressive";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  created_at: string;
  genre?: string;
}

interface Like {
  track: Track;
  liked_at: string;
  liked_order: number;
}

type SortOption = "recent" | "oldest" | "alpha";

export default function LikeManagerPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [genreFilter, setGenreFilter] = useState("All");
  const [durationFilter, setDurationFilter] = useState("All");
  const [showUnlikeConfirm, setShowUnlikeConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [unlikeProgress, setUnlikeProgress] = useState<{
    completed: number;
    total: number;
    currentBatch: number;
    totalBatches: number;
  } | null>(null);
  
  const likesState = useProgressiveLikes<{ track?: Track; created_at?: string } & Track>();

  const likes: Like[] = useMemo(
    () =>
      likesState.items.map((item, index) => {
        if (item.track) {
          return {
            track: item.track,
            liked_at: item.created_at || "",
            liked_order: index,
          };
        }

        return {
          track: item,
          liked_at: "",
          liked_order: index,
        };
      }),
    [likesState.items],
  );

  useEffect(() => {
    if (likesState.error) {
      setNotice({ type: "error", text: `Couldn't load your liked tracks: ${likesState.error.message}` });
    }
  }, [likesState.error]);

  const toggleTrack = (id: number, index: number, currentFilteredLikes: Like[], event?: React.MouseEvent | React.KeyboardEvent) => {
    const isShiftKey = event && 'shiftKey' in event && event.shiftKey;

    if (isShiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(currentFilteredLikes[i].track.id);
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

  const uniqueGenres = useMemo(
    () => Array.from(new Set(likes.map((l) => l.track.genre).filter(Boolean))) as string[],
    [likes],
  );

  const selectAll = () => {
    if (selected.size === filteredLikes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLikes.map((l) => l.track.id)));
    }
  };

  const handleBulkUnlike = async () => {
    if (selected.size === 0) return;
    setShowUnlikeConfirm(true);
  };

  const executeBulkUnlike = async () => {
    setShowUnlikeConfirm(false);
    setRemoving(true);
    setNotice(null);
    try {
      const trackIds = Array.from(selected);
      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(trackIds.length / BATCH_SIZE);
      const allResults: Array<{ trackId: number; status: string; error?: string }> = [];
      let completed = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batchIds = trackIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        
        setUnlikeProgress({
          completed,
          total: trackIds.length,
          currentBatch: i + 1,
          totalBatches,
        });

        const response = await apiFetch("/api/likes/tracks/bulk-unlike", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: batchIds }),
        });

        if (response.ok) {
          const data = await response.json();
          allResults.push(...data.results);
          completed += batchIds.length;
        } else {
          console.error(`Batch ${i + 1} failed`);
        }
      }

      const removedIds = new Set<number>(
        allResults
          .filter((r: { status: string }) => r.status === "ok")
          .map((r: { trackId: number }) => r.trackId),
      );
      
      if (removedIds.size > 0) {
        removeTracksFromLikesCache(queryClient, removedIds);
        await invalidateDashboardSummary(queryClient);
      }
      
      setSelected(new Set());
      if (removedIds.size === trackIds.length && trackIds.length > 0) {
        setNotice({ type: "success", text: `Unliked ${removedIds.size} track${removedIds.size === 1 ? "" : "s"}.` });
      } else if (removedIds.size > 0) {
        setNotice({
          type: "error",
          text: `Unliked ${removedIds.size} of ${trackIds.length} tracks. Some tracks could not be removed.`,
        });
      } else {
        setNotice({ type: "error", text: "Bulk unlike failed. Please try again." });
      }
    } catch (error) {
      console.error("Bulk unlike error:", error);
      setNotice({ type: "error", text: "An error occurred while unliking tracks." });
    } finally {
      setRemoving(false);
      setUnlikeProgress(null);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const debouncedSearch = useDebouncedValue(search, 150);

  const filteredLikes = useMemo(() => {
    const query = debouncedSearch.toLowerCase();

    // Precompute each track's sort key once instead of parsing `liked_at`
    // into a Date twice per comparison inside .sort().
    const withSortKey = likes
      .filter(
        (l) =>
          !query ||
          l.track.title.toLowerCase().includes(query) ||
          l.track.user?.username?.toLowerCase().includes(query)
      )
      .filter((l) => genreFilter === "All" || l.track.genre === genreFilter)
      .filter((l) => {
        if (durationFilter === "All") return true;
        const mins = l.track.duration / 60000;
        if (durationFilter === "< 3 mins") return mins < 3;
        if (durationFilter === "3-5 mins") return mins >= 3 && mins <= 5;
        if (durationFilter === "5-10 mins") return mins > 5 && mins <= 10;
        if (durationFilter === "> 10 mins") return mins > 10;
        return true;
      })
      .map((l) => ({
        like: l,
        likedAtMs: l.liked_at ? new Date(l.liked_at).getTime() : null,
      }));

    withSortKey.sort((a, b) => {
      if (sort === "alpha") return a.like.track.title.localeCompare(b.like.track.title);

      if (a.likedAtMs != null && b.likedAtMs != null) {
        if (sort === "oldest") return a.likedAtMs - b.likedAtMs;
        return b.likedAtMs - a.likedAtMs;
      }

      if (sort === "oldest") return b.like.liked_order - a.like.liked_order;
      return a.like.liked_order - b.like.liked_order;
    });

    return withSortKey.map((entry) => entry.like);
  }, [likes, debouncedSearch, genreFilter, durationFilter, sort]);

  // Virtualize the list — only the rows actually scrolled into view get
  // mounted. `virtualRow.index` is the row's index into `filteredLikes`
  // itself (react-virtual indexes by full-list position, not by visible
  // window), so it's exactly the index shift-click range-selection needs.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredLikes.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 72, // 64px TrackRow (h-16) + 8px gap
    overscan: 8,
  });

  // Only computed while the confirm dialog is open (or about to be) — no
  // point building this on every keystroke/re-render while it's closed.
  const unlikeReviewItems = useMemo(() => {
    if (!showUnlikeConfirm) return [];
    return likes
      .filter((like) => selected.has(like.track.id))
      .map((like) => ({
        id: like.track.id,
        label: like.track.title,
        meta: like.track.user?.username,
      }));
  }, [likes, selected, showUnlikeConfirm]);

  // Only pass a filteredCount through to progressiveStatus when a filter is
  // actually narrowing the list — otherwise "Matching N of N loaded" reads as
  // noise where "Showing N — still loading…" says the same thing more plainly.
  const hasActiveFilter = Boolean(debouncedSearch) || genreFilter !== "All" || durationFilter !== "All";
  const likesStatus = progressiveStatus(
    likesState,
    "tracks",
    hasActiveFilter ? { filteredCount: filteredLikes.length } : {},
  );

  return (
    <PageContainer maxWidth="wide" className={selected.size > 0 ? "pb-28" : ""}>
        <PageHeader
          title="Like Manager"
          description="Browse, search, and manage your liked tracks. Unlike in bulk."
        />

        {notice && (
          <InlineAlert
            variant={notice.type}
            className="mb-6"
            onDismiss={() => setNotice(null)}
          >
            {notice.text}
          </InlineAlert>
        )}

        {removing && unlikeProgress && (
          <div className="mb-6 p-4 rounded-lg border-2 border-border bg-secondary/10">
            <div className="text-sm font-medium text-foreground mb-2">
              Unliking tracks… {unlikeProgress.completed}/{unlikeProgress.total} (batch {unlikeProgress.currentBatch} of {unlikeProgress.totalBatches})
            </div>
            <div className="w-full h-1.5 rounded bg-secondary/30 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(unlikeProgress.completed / unlikeProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {likesState.isLoadingFirstPage ? (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Skeleton className="h-10 flex-1 min-w-[200px] rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </Card>
        ) : likes.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<Heart className="w-12 h-12" />}
              title="No liked tracks"
              description="You haven't liked any tracks yet."
            />
          </Card>
        ) : (
          <Card className="p-6">
            {/* Controls */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search likes..."
                  className="pl-9 h-10 bg-secondary/20 border-border"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="h-10 px-3 border-2 border-border rounded-lg text-sm text-foreground bg-secondary/20 focus:border-primary focus:outline-none"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">A → Z</option>
              </select>
              {uniqueGenres.length > 0 && (
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="h-10 px-3 border-2 border-border rounded-lg text-sm text-foreground bg-secondary/20 focus:border-primary focus:outline-none max-w-[150px] truncate"
                >
                  <option value="All">All Genres</option>
                  {uniqueGenres.map((g) => (
                     <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                className="h-10 px-3 border-2 border-border rounded-lg text-sm text-foreground bg-secondary/20 focus:border-primary focus:outline-none"
              >
                <option value="All">All Durations</option>
                <option value="< 3 mins">&lt; 3 mins</option>
                <option value="3-5 mins">3-5 mins</option>
                <option value="5-10 mins">5-10 mins</option>
                <option value="> 10 mins">&gt; 10 mins</option>
              </select>
              <button
                onClick={selectAll}
                className="text-sm text-primary hover:text-primary/80 font-medium whitespace-nowrap"
              >
                {selected.size === filteredLikes.length
                  ? "Deselect All"
                  : selectAllLabel(likesState, filteredLikes.length)}
              </button>
            </div>

            {likesStatus && (
              <div className="text-sm text-muted-foreground mb-2">{likesStatus}</div>
            )}

            <ProgressiveBlur
              ref={listScrollRef}
              className="max-h-[600px] overflow-y-auto"
              active={filteredLikes.length > 8}
              fadeHeight={72}
            >
              <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const like = filteredLikes[virtualRow.index];
                  const track = like.track;
                  const isSelected = selected.has(track.id);
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
                      <TrackRow
                        track={{ ...track, subtitle: track.user?.username }}
                        isSelected={isSelected}
                        onToggle={(e) => toggleTrack(track.id, virtualRow.index, filteredLikes, e)}
                        rightSlot={
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(track.duration)}
                          </span>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </ProgressiveBlur>

            {likesState.isLoadingMore && (
              <div className="flex items-center justify-center gap-2 pt-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more…
              </div>
            )}
          </Card>
        )}
      <SelectionBanner
        count={selected.size}
        entityName="track"
        actionLabel={removing && unlikeProgress ? `Unliking ${unlikeProgress.completed}/${unlikeProgress.total}…` : "Unlike Selected"}
        actionVariant="destructive"
        onAction={handleBulkUnlike}
        disabled={removing}
        actionIcon={removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      />
      <ConfirmDialog
        open={showUnlikeConfirm}
        title="Unlike selected tracks?"
        description={`Unlike ${selected.size} track${selected.size === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Unlike"
        variant="destructive"
        onConfirm={executeBulkUnlike}
        onCancel={() => setShowUnlikeConfirm(false)}
      >
        <BulkReviewDetails
          action="unliking"
          warning="SoundCloud does not provide a reliable undo for bulk unlikes. Export the selection if you want a record first."
          exportFilename="tracks-to-unlike.csv"
          items={unlikeReviewItems}
        />
      </ConfirmDialog>
    </PageContainer>
  );
}
