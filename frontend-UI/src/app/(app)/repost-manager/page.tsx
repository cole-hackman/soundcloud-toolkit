"use client";

import { useState, useEffect } from "react";
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
} from "@/components/ui";
import { apiFetch } from "@/lib/api";

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
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchReposts();
  }, []);

  const fetchReposts = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/reposts");
      if (response.ok) {
        const data = await response.json();
        setReposts(data.collection || []);
      } else {
        setNotice({ type: "error", text: "Couldn’t load your reposts. Try refreshing the page." });
      }
    } catch (error) {
      console.error("Failed to fetch reposts:", error);
      setNotice({ type: "error", text: "Couldn’t load your reposts. Try refreshing the page." });
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

      const response = await apiFetch("/api/reposts/bulk-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        if (removedIds.size === items.length) {
          setNotice({ type: "success", text: `Removed ${removedIds.size} repost${removedIds.size === 1 ? "" : "s"}.` });
        } else {
          setNotice({
            type: "error",
            text: `Removed ${removedIds.size} of ${items.length} reposts. Some failed.`,
          });
        }
      } else {
        setNotice({ type: "error", text: "Bulk remove failed. Please try again." });
      }
    } catch (error) {
      console.error("Bulk remove error:", error);
      setNotice({ type: "error", text: "An error occurred while removing reposts." });
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
                      className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${
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
          items={reposts
            .filter((repost) => selected.has(repost.id))
            .map((repost) => ({
              id: repost.id,
              label: repost.title,
              meta: `${repost.resourceType} by ${repost.user?.username || "Unknown"}`,
            }))}
        />
      </ConfirmDialog>
    </PageContainer>
  );
}
