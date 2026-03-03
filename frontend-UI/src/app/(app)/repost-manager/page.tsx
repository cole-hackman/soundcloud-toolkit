"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Repeat2,
  Music,
  ListMusic,
  Search,
  Trash2,
  Loader2,
  Check,
  Info,
} from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

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

export default function RepostManagerPage() {
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");

  useEffect(() => {
    fetchReposts();
  }, []);

  const fetchReposts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/reposts`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setReposts(data.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch reposts:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    if (
      !confirm(
        `Remove ${selected.size} repost${selected.size > 1 ? "s" : ""}? This cannot be undone.`
      )
    )
      return;

    setRemoving(true);
    try {
      const items = reposts
        .filter((r) => selected.has(r.id))
        .map((r) => ({ id: r.id, resourceType: r.resourceType }));

      const response = await fetch(`${API_BASE}/api/reposts/bulk-remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });

      if (response.ok) {
        const data = await response.json();
        const removedIds = new Set(
          data.results
            .filter((r: { status: string }) => r.status === "ok")
            .map((r: { id: number }) => r.id)
        );
        setReposts((prev) => prev.filter((r) => !removedIds.has(r.id)));
        setSelected(new Set());
      } else {
        alert("Bulk remove failed");
      }
    } catch (error) {
      console.error("Bulk remove error:", error);
      alert("An error occurred");
    } finally {
      setRemoving(false);
    }
  };

  const filteredReposts = reposts
    .filter(
      (r) =>
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.user?.username?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "alpha") return a.title.localeCompare(b.title);
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (sort === "oldest") return aTime - bTime;
      return bTime - aTime;
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
            Repost Manager
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Browse, search, and manage your reposted tracks and playlists. Remove in bulk.
          </p>
        </div>

        {/* Info notice about activity-feed limitation */}
        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-xl p-4 mb-6 text-sm text-blue-700 dark:text-blue-400">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Reposts are loaded from your recent SoundCloud activity feed. Very old reposts
            may not appear here due to API limitations.
          </span>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-card rounded-2xl p-12 border-2 border-gray-200 dark:border-border flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : reposts.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border">
            <EmptyState
              icon={<Repeat2 className="w-12 h-12" />}
              title="No reposts found"
              description="You haven't reposted any tracks or playlists recently."
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
                  placeholder="Search reposts..."
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
                {selected.size === filteredReposts.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            {/* Action bar */}
            {selected.size > 0 && (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-3 mb-4">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {selected.size} repost{selected.size > 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={handleBulkRemove}
                  disabled={removing}
                  className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {removing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove Reposts
                </button>
              </div>
            )}

            <div className="text-sm text-[#999999] dark:text-muted-foreground mb-2">
              {filteredReposts.length} of {reposts.length} reposts
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredReposts.map((repost) => {
                const isSelected = selected.has(repost.id);
                return (
                  <button
                    key={`${repost.resourceType}-${repost.id}`}
                    onClick={() => toggleItem(repost.id)}
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
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-secondary flex items-center justify-center flex-shrink-0">
                        {repost.resourceType === "playlist" ? (
                          <ListMusic className="w-5 h-5 text-[#999999] dark:text-muted-foreground" />
                        ) : (
                          <Music className="w-5 h-5 text-[#999999] dark:text-muted-foreground" />
                        )}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#333333] dark:text-foreground text-sm truncate">
                        {repost.title}
                      </div>
                      <div className="text-xs text-[#666666] dark:text-muted-foreground truncate">
                        {repost.user?.username}
                      </div>
                    </div>

                    {/* Type badge */}
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                        repost.resourceType === "playlist"
                          ? "bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
                          : "bg-orange-100 dark:bg-orange-900/20 text-[#FF5500]"
                      }`}
                    >
                      {repost.resourceType}
                    </span>
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
