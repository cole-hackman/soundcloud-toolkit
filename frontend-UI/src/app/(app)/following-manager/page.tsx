"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Search, UserMinus, Loader2, Check, ExternalLink } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Following {
  id: number;
  username: string;
  avatar_url: string;
  permalink_url: string;
  followers_count: number;
  track_count: number;
}

type SortOption = "alpha" | "followers" | "tracks";

export default function FollowingManagerPage() {
  const [followings, setFollowings] = useState<Following[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("alpha");
  const [followers, setFollowers] = useState<Set<number>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "not-following-back">("all");

  useEffect(() => {
    fetchFollowings();
  }, []);

  const fetchFollowings = async () => {
    try {
      const [followingsRes, followersRes] = await Promise.all([
        fetch(`${API_BASE}/api/followings`, { credentials: "include" }),
        fetch(`${API_BASE}/api/followers`, { credentials: "include" })
      ]);

      if (followingsRes.ok) {
        const data = await followingsRes.json();
        setFollowings(data.collection || []);
      }
      
      if (followersRes.ok) {
        const data = await followersRes.json();
        const followerIds = new Set<number>((data.collection || []).map((u: Following) => u.id));
        setFollowers(followerIds);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filteredFollowings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredFollowings.map((f) => f.id)));
    }
  };

  const handleBulkUnfollow = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Unfollow ${selected.size} user${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;

    setRemoving(true);
    try {
      const userIds = Array.from(selected);
      const response = await fetch(`${API_BASE}/api/followings/bulk-unfollow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds }),
      });
      if (response.ok) {
        const data = await response.json();
        const removedIds = new Set(
          data.results
            .filter((r: { status: string }) => r.status === "ok")
            .map((r: { userId: number }) => r.userId)
        );
        setFollowings((prev) => prev.filter((f) => !removedIds.has(f.id)));
        setSelected(new Set());
      } else {
        alert("Bulk unfollow failed");
      }
    } catch (error) {
      console.error("Bulk unfollow error:", error);
      alert("An error occurred");
    } finally {
      setRemoving(false);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const filteredFollowings = followings
    .filter((f) => {
      const matchesSearch = !search || f.username?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filterMode === "all" || !followers.has(f.id);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sort === "alpha") return (a.username || "").localeCompare(b.username || "");
      if (sort === "followers") return (b.followers_count || 0) - (a.followers_count || 0);
      return (b.track_count || 0) - (a.track_count || 0);
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
            Following Manager
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Browse and manage who you follow. Unfollow accounts in bulk.
          </p>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-card rounded-2xl p-12 border-2 border-gray-200 dark:border-border flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : followings.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border">
            <EmptyState
              icon={<Users className="w-12 h-12" />}
              title="Not following anyone"
              description="You don't follow any users yet."
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
                  placeholder="Search followings..."
                  className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="px-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none"
              >
                <option value="alpha">A → Z</option>
                <option value="followers">Most Followers</option>
                <option value="tracks">Most Tracks</option>
              </select>
              
              <div className="flex bg-gray-100 dark:bg-secondary/20 p-1 rounded-lg">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filterMode === "all" ? "bg-white dark:bg-card text-[#333333] dark:text-foreground shadow-sm" : "text-[#666666] dark:text-muted-foreground hover:text-[#333333] dark:hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterMode("not-following-back")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filterMode === "not-following-back" ? "bg-white dark:bg-card text-[#FF5500] shadow-sm" : "text-[#666666] dark:text-muted-foreground hover:text-[#333333] dark:hover:text-foreground"
                  }`}
                >
                  Not Following Back
                </button>
              </div>

              <button
                onClick={selectAll}
                className="text-sm text-[#FF5500] hover:text-[#E64D00] font-medium whitespace-nowrap"
              >
                {selected.size === filteredFollowings.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            {/* Action bar */}
            {selected.size > 0 && (
              <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-3 mb-4">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                  {selected.size} user{selected.size > 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={handleBulkUnfollow}
                  disabled={removing}
                  className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {removing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserMinus className="w-4 h-4" />
                  )}
                  Unfollow Selected
                </button>
              </div>
            )}

            <div className="text-sm text-[#999999] dark:text-muted-foreground mb-2">
              {filteredFollowings.length} of {followings.length} followings
            </div>

            <div className="grid md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
              {filteredFollowings.map((user) => {
                const isSelected = selected.has(user.id);
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isSelected
                        ? "bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-900/30"
                        : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                    }`}
                  >
                    <button
                      onClick={() => toggleUser(user.id)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-red-500 text-white" : "bg-gray-200 dark:bg-secondary"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <img
                      src={user.avatar_url || "/SC Toolkit Icon.png"}
                      alt={user.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#333333] dark:text-foreground text-sm truncate">{user.username}</div>
                      <div className="text-xs text-[#666666] dark:text-muted-foreground">
                        {formatNumber(user.followers_count || 0)} followers • {formatNumber(user.track_count || 0)} tracks
                      </div>
                    </div>
                    <a
                      href={user.permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#FF5500] hover:text-[#E64D00] flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
