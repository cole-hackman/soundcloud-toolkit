"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, Music, Search, Trash2, Loader2, Check } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

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
  created_at: string;
}

type SortOption = "recent" | "oldest" | "alpha";

export default function LikeManagerPage() {
  const [likes, setLikes] = useState<Like[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");

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
        // Normalize: SC returns { track: {...}, created_at } objects
        setLikes(
          collection.map((item: { track?: Track; created_at?: string } & Track) => {
            if (item.track) return item as Like;
            return { track: item, created_at: item.created_at || "" } as Like;
          })
        );
      }
    } catch (error) {
      console.error("Failed to fetch likes:", error);
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
    if (!confirm(`Unlike ${selected.size} track${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;

    setRemoving(true);
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
      } else {
        alert("Bulk unlike failed");
      }
    } catch (error) {
      console.error("Bulk unlike error:", error);
      alert("An error occurred");
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
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        <div className="mb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">
            Like Manager
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Browse, search, and manage your liked tracks. Unlike in bulk.
          </p>
        </div>

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

            {/* Action bar */}
            {selected.size > 0 && (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-3 mb-4">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {selected.size} track{selected.size > 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={handleBulkUnlike}
                  disabled={removing}
                  className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {removing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Unlike Selected
                </button>
              </div>
            )}

            <div className="text-sm text-[#999999] dark:text-muted-foreground mb-2">
              {filteredLikes.length} of {likes.length} tracks
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredLikes.map((like) => {
                const track = like.track;
                const isSelected = selected.has(track.id);
                return (
                  <button
                    key={track.id}
                    onClick={() => toggleTrack(track.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? "bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-900/30"
                        : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-red-500 text-white" : "bg-gray-200 dark:bg-secondary"
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <img
                      src={track.artwork_url || "/SC Toolkit Icon.png"}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#333333] dark:text-foreground text-sm truncate">{track.title}</div>
                      <div className="text-xs text-[#666666] dark:text-muted-foreground truncate">
                        {track.user?.username} • {formatDuration(track.duration)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
