"use client";

import { useState, useEffect } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
  TrackRow,
  Card,
  Input,
  Button
} from "@/components/ui";
import { ProgressiveBlur } from "@/components/ui/ProgressiveBlur";
import { apiFetch } from "@/lib/api";
import { invalidateDashboardSummary, removeTracksFromLikesCache, likesQueryOptions } from "@/lib/queries";

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
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [genreFilter, setGenreFilter] = useState("All");
  const [durationFilter, setDurationFilter] = useState("All");
  const [showUnlikeConfirm, setShowUnlikeConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const { data } = useSuspenseQuery(likesQueryOptions());

  const likes: Like[] = ((data?.collection || []) as unknown as Array<{ track?: Track; created_at?: string } & Track>).map(
    (item, index) => {
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
    },
  );

  const toggleTrack = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uniqueGenres = Array.from(
    new Set(likes.map((l) => l.track.genre).filter(Boolean))
  ) as string[];

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
      const response = await apiFetch("/api/likes/tracks/bulk-unlike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds }),
      });
      if (response.ok) {
        const data = await response.json();
        const removedIds = new Set<number>(
          data.results
            .filter((r: { status: string }) => r.status === "ok")
            .map((r: { trackId: number }) => r.trackId),
        );
        removeTracksFromLikesCache(queryClient, removedIds);
        await invalidateDashboardSummary(queryClient);
        setSelected(new Set());
        if (removedIds.size === trackIds.length) {
          setNotice({ type: "success", text: `Unliked ${removedIds.size} track${removedIds.size === 1 ? "" : "s"}.` });
        } else {
          setNotice({
            type: "error",
            text: `Unliked ${removedIds.size} of ${trackIds.length} tracks. Some tracks could not be removed.`,
          });
        }
      } else {
        setNotice({ type: "error", text: "Bulk unlike failed. Please try again." });
      }
    } catch (error) {
      console.error("Bulk unlike error:", error);
      setNotice({ type: "error", text: "An error occurred while unliking tracks." });
    } finally {
      setRemoving(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const filteredLikes = likes
    .filter(
      (l) =>
        !search ||
        l.track.title.toLowerCase().includes(search.toLowerCase()) ||
        l.track.user?.username?.toLowerCase().includes(search.toLowerCase())
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
    .sort((a, b) => {
      if (sort === "alpha") return a.track.title.localeCompare(b.track.title);

      if (a.liked_at && b.liked_at) {
        const aLikedAt = new Date(a.liked_at).getTime();
        const bLikedAt = new Date(b.liked_at).getTime();
        if (sort === "oldest") return aLikedAt - bLikedAt;
        return bLikedAt - aLikedAt;
      }

      if (sort === "oldest") return b.liked_order - a.liked_order;
      return a.liked_order - b.liked_order;
    });

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

        {likes.length === 0 ? (
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
                {selected.size === filteredLikes.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="text-sm text-muted-foreground mb-2">
              {filteredLikes.length} of {likes.length} tracks
            </div>

            <ProgressiveBlur
              className="max-h-[600px] overflow-y-auto"
              active={filteredLikes.length > 8}
              fadeHeight={72}
            >
              <div className="space-y-2">
                {filteredLikes.map((like) => {
                  const track = like.track;
                  const isSelected = selected.has(track.id);
                  return (
                    <TrackRow
                      key={track.id}
                      track={{ ...track, subtitle: track.user?.username }}
                      isSelected={isSelected}
                      onToggle={() => toggleTrack(track.id)}
                      rightSlot={
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(track.duration)}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            </ProgressiveBlur>
          </Card>
        )}
      <SelectionBanner
        count={selected.size}
        entityName="track"
        actionLabel="Unlike Selected"
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
          items={likes
            .filter((like) => selected.has(like.track.id))
            .map((like) => ({
              id: like.track.id,
              label: like.track.title,
              meta: like.track.user?.username,
            }))}
        />
      </ConfirmDialog>
    </PageContainer>
  );
}
