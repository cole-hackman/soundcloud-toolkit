"use client";

import { useState, useEffect } from "react";
import { Heart, Search, Trash2, Loader2 } from "lucide-react";
import {
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageHeader,
  SelectionBanner,
  TrackRow,
} from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  created_at: string;
}

interface Like {
  track: Track;
  liked_at: string;
  liked_order: number;
}

type SortOption = "recent" | "oldest" | "alpha";

export default function LikeManagerPage() {
  const [likes, setLikes] = useState<Like[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [showUnlikeConfirm, setShowUnlikeConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchLikes();
  }, []);

  const fetchLikes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/likes?limit=200`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const collection = data.collection || [];
        setLikes(
          collection.map((item: { track?: Track; created_at?: string } & Track, index: number) => {
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
          })
        );
      } else {
        setNotice({ type: "error", text: "Couldn’t load your liked tracks. Try refreshing the page." });
      }
    } catch (error) {
      console.error("Failed to fetch likes:", error);
      setNotice({ type: "error", text: "Couldn’t load your liked tracks. Try refreshing the page." });
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      const response = await fetch(`${API_BASE}/api/likes/tracks/bulk-unlike`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trackIds }),
      });
      if (response.ok) {
        const data = await response.json();
        const removedIds = new Set(data.results.filter((r: { status: string }) => r.status === "ok").map((r: { trackId: number }) => r.trackId));
        setLikes((prev) => prev.filter((l) => !removedIds.has(l.track.id)));
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
    <div className="min-h-screen bg-background">
      <div className={`container mx-auto max-w-6xl px-6 py-6 ${selected.size > 0 ? "pb-28" : ""}`}>
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

        {loading ? (
          <div className="bg-white dark:bg-card rounded-2xl p-12 border-2 border-gray-200 dark:border-border flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : likes.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border">
            <EmptyState
              icon={<Heart className="w-12 h-12" />}
              title="No liked tracks"
              description="You haven't liked any tracks yet."
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            {/* Controls */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999] dark:text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search likes..."
                  className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="px-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="alpha">A → Z</option>
              </select>
              <button
                onClick={selectAll}
                className="text-sm text-[#FF5500] hover:text-[#E64D00] font-medium whitespace-nowrap"
              >
                {selected.size === filteredLikes.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="text-sm text-[#999999] dark:text-muted-foreground mb-2">
              {filteredLikes.length} of {likes.length} tracks
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                      <span className="text-xs text-[#666666] dark:text-muted-foreground">
                        {formatDuration(track.duration)}
                      </span>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
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
      />
    </div>
  );
}
