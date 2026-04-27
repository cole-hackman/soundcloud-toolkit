"use client";

import { useState, useEffect } from "react";
import { Users, Search, UserMinus, Loader2, Check, ExternalLink } from "lucide-react";
import {
  ConfirmDialog,
  BulkReviewDetails,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageHeader,
  SelectionBanner,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";

interface Following {
  id: number;
  username: string;
  avatar_url: string;
  permalink_url: string;
  followers_count: number;
  track_count: number;
  reposts_count?: number;
  last_modified?: string;
}

type SortOption = "alpha" | "followers" | "tracks" | "reposts" | "last_modified";

export default function FollowingManagerPage() {
  const [followings, setFollowings] = useState<Following[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("alpha");
  const [followers, setFollowers] = useState<Set<number>>(new Set());
  const [filterMode, setFilterMode] = useState<"all" | "not-following-back">("all");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchFollowings();
  }, []);

  const fetchFollowings = async () => {
    try {
      const [followingsRes, followersRes] = await Promise.all([
        apiFetch("/api/followings"),
        apiFetch("/api/followers")
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
      if (!followingsRes.ok) {
        setNotice({ type: "error", text: "Couldn’t load the accounts you follow. Try refreshing the page." });
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setNotice({ type: "error", text: "Couldn’t load your social data. Try refreshing the page." });
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
    setShowUnfollowConfirm(true);
  };

  const executeBulkUnfollow = async () => {
    setShowUnfollowConfirm(false);
    setRemoving(true);
    setProgress({ current: 0, total: selected.size });
    setNotice(null);
    
    // Chunk size for bulk operations (SoundCloud API limit usually 50-100)
    // We use smaller chunks to be safe and show progress
    const CHUNK_SIZE = 50;
    const allUserIds = Array.from(selected);
    const successfullyRemoved = new Set<number>();
    
    try {
      for (let i = 0; i < allUserIds.length; i += CHUNK_SIZE) {
        const chunk = allUserIds.slice(i, i + CHUNK_SIZE);
        
        try {
          const response = await apiFetch("/api/followings/bulk-unfollow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: chunk }),
          });

          if (response.ok) {
            const data = await response.json();
            data.results
              .filter((r: { status: string; userId: number }) => r.status === "ok")
              .forEach((r: { userId: number }) => successfullyRemoved.add(r.userId));
          }
        } catch (err) {
          console.error(`Failed to unfollow chunk ${i}-${i + CHUNK_SIZE}`, err);
        }

        // Update progress
        setProgress({ 
          current: Math.min(i + CHUNK_SIZE, allUserIds.length), 
          total: allUserIds.length 
        });
      }
      
      // Update UI state
      if (successfullyRemoved.size > 0) {
        setFollowings((prev) => prev.filter((f) => !successfullyRemoved.has(f.id)));
        
        // Remove successfully unfollowed IDs from selection
        setSelected(prev => {
          const next = new Set(prev);
          successfullyRemoved.forEach(id => next.delete(id));
          return next;
        });

        if (successfullyRemoved.size < allUserIds.length) {
          setNotice({
            type: "error",
            text: `Unfollowed ${successfullyRemoved.size} of ${allUserIds.length} users. Some failed.`,
          });
        } else {
          setNotice({
            type: "success",
            text: `Unfollowed ${successfullyRemoved.size} user${successfullyRemoved.size === 1 ? "" : "s"}.`,
          });
        }
      } else {
        setNotice({ type: "error", text: "Bulk unfollow failed. Please try again." });
      }

    } catch (error) {
      console.error("Bulk unfollow error:", error);
      setNotice({ type: "error", text: "An error occurred during bulk unfollow." });
    } finally {
      setRemoving(false);
      setProgress(null);
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDate = (dateStr?: string | number | null) => {
    if (!dateStr) return "N/A";
    try {
      let d = new Date(dateStr);
      
      // Fallback for Safari not parsing SC API "YYYY/MM/DD HH:MM:SS +0000" correctly
      if (isNaN(d.getTime()) && typeof dateStr === "string" && dateStr.includes("/")) {
        d = new Date(dateStr.replace(/\//g, "-").replace(" ", "T"));
      }
      
      // Re-check validity
      if (isNaN(d.getTime())) return "N/A";
      
      // Prevent "Dec 31, 1969" issue by rejecting zero or epoch-close dates
      if (d.getFullYear() <= 1970) return "N/A";

      return d.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return "N/A";
    }
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
      if (sort === "tracks") return (b.track_count || 0) - (a.track_count || 0);
      if (sort === "reposts") return (b.reposts_count || 0) - (a.reposts_count || 0);
      if (sort === "last_modified") {
        const getParseableTime = (d?: string | null) => {
          if (!d) return 0;
          let parsed = new Date(d);
          if (isNaN(parsed.getTime()) && typeof d === 'string' && d.includes('/')) {
            parsed = new Date(d.replace(/\//g, '-').replace(' ', 'T'));
          }
          const time = parsed.getTime();
          return isNaN(time) ? 0 : time;
        };
        const dateA = getParseableTime(a.last_modified);
        const dateB = getParseableTime(b.last_modified);
        return dateB - dateA; // Newest first
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
      <div className={`container mx-auto px-6 py-6 max-w-6xl ${selected.size > 0 ? "pb-28" : ""}`}>
        <PageHeader
          title="Following Manager"
          description="Browse and manage who you follow. Unfollow accounts in bulk."
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
                <option value="reposts">Most Reposts</option>
                <option value="last_modified">Recently Active</option>
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
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-[#333333] dark:text-foreground text-sm truncate">
                          {user.username}
                        </div>
                        {user.last_modified && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                             Active: {formatDate(user.last_modified)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#666666] dark:text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        <span>{formatNumber(user.followers_count || 0)} followers</span>
                        <span>{formatNumber(user.track_count || 0)} tracks</span>
                        {user.reposts_count !== undefined && (
                          <span>{formatNumber(user.reposts_count)} reposts</span>
                        )}
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
      <SelectionBanner
        count={selected.size}
        entityName="user"
        actionLabel={progress ? `Unfollowing ${progress.current}/${progress.total}...` : "Unfollow Selected"}
        actionVariant="destructive"
        onAction={handleBulkUnfollow}
        disabled={removing}
        actionIcon={removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
      />
      <ConfirmDialog
        open={showUnfollowConfirm}
        title="Unfollow selected users?"
        description={`Unfollow ${selected.size} user${selected.size === 1 ? "" : "s"}? This cannot be undone.`}
        confirmLabel="Unfollow"
        variant="destructive"
        onConfirm={executeBulkUnfollow}
        onCancel={() => setShowUnfollowConfirm(false)}
      >
        <BulkReviewDetails
          action="unfollowing"
          warning="This removes accounts from your following list. Export the selection if you need a record."
          exportFilename="users-to-unfollow.csv"
          items={followings
            .filter((following) => selected.has(following.id))
            .map((following) => ({
              id: following.id,
              label: following.username,
              meta: `${following.followers_count?.toLocaleString?.() || 0} followers`,
            }))}
        />
      </ConfirmDialog>
    </div>
  );
}
