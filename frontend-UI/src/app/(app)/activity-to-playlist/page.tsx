"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Radio, Music, Loader2, Search, SquarePlus } from "lucide-react";
import {
  Button,
  EmptyState,
  InlineAlert,
  Input,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  TrackRow,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  invalidatePlaylistCaches,
  useActivitiesQuery,
  usePlaylistDetailQuery,
  usePlaylistsQuery,
} from "@/lib/queries";

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  permalink_url: string;
}

interface Activity {
  type: string;
  created_at: string;
  reposter?: string | null;
  origin: Track;
}

interface Playlist {
  id: number;
  title: string;
  track_count: number;
}

export default function ActivityToPlaylistPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const activitiesQuery = useActivitiesQuery(200);
  const playlistsQuery = usePlaylistsQuery();
  const selectedPlaylistQuery = usePlaylistDetailQuery(selectedPlaylistId ?? 0, {
    enabled: mode === "existing" && selectedPlaylistId != null,
  });
  const activities = (activitiesQuery.data?.collection || []) as unknown as Activity[];
  const playlists = (playlistsQuery.data?.collection || []) as unknown as Playlist[];
  const loading = activitiesQuery.isLoading || playlistsQuery.isLoading;

  useEffect(() => {
    if (activitiesQuery.isError || playlistsQuery.isError) {
      setNotice({ type: "error", text: "Couldn’t load your activity feed. Try refreshing the page." });
    }
  }, [activitiesQuery.isError, playlistsQuery.isError]);

  const toggleTrack = (id: number, index: number, currentFilteredActivities: Activity[], event?: React.MouseEvent | React.KeyboardEvent) => {
    const isShiftKey = event && 'shiftKey' in event && event.shiftKey;

    if (isShiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(currentFilteredActivities[i].origin.id);
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
    if (selected.size === filteredActivities.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredActivities.map((a) => a.origin.id)));
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const filteredActivities = activities.filter((a) =>
    !search || a.origin.title.toLowerCase().includes(search.toLowerCase()) ||
    a.origin.user?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setNotice(null);

    try {
      const trackIds = Array.from(selected);

      if (mode === "new") {
        const title = newPlaylistName.trim() || `Activity Tracks ${new Date().toLocaleDateString()}`;
        const response = await apiFetch("/api/playlists/from-likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds, title }),
        });
        if (response.ok) {
          await invalidatePlaylistCaches(queryClient);
          setNotice({ type: "success", text: "Playlist saved successfully." });
          setSelected(new Set());
        } else {
          setNotice({ type: "error", text: "Failed to create playlist." });
        }
      } else if (selectedPlaylistId) {
        if (selectedPlaylistQuery.data) {
          const existingIds = ((selectedPlaylistQuery.data.tracks || []) as unknown as Track[]).map((t) => t.id);
          const mergedIds = [...existingIds, ...trackIds];
          const response = await apiFetch(`/api/playlists/${selectedPlaylistId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tracks: mergedIds }),
          });
          if (response.ok) {
            await invalidatePlaylistCaches(queryClient, selectedPlaylistId);
            setNotice({ type: "success", text: "Playlist saved successfully." });
            setSelected(new Set());
          } else {
            setNotice({ type: "error", text: "Failed to update playlist." });
          }
        } else {
          setNotice({ type: "error", text: "Couldn’t load the selected playlist." });
        }
      }
    } catch (error) {
      console.error("Save error:", error);
      setNotice({ type: "error", text: "An error occurred while saving the playlist." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer maxWidth="wide">
        <PageHeader
          title="Activity → Playlist"
          description="Select tracks from your activity feed and save them to a playlist."
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
        ) : activities.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-2xl p-8 border-2 border-gray-200 dark:border-border">
            <EmptyState
              icon={<Radio className="w-12 h-12" />}
              title="No activities found"
              description="Your activity feed appears to be empty."
            />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Track list */}
            <div className="lg:col-span-2 bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999] dark:text-muted-foreground" />
                  <Input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tracks..."
                    className="pl-10"
                  />
                </div>
                <button
                  onClick={selectAll}
                  className="text-sm text-[#FF5500] hover:text-[#E64D00] font-medium whitespace-nowrap"
                >
                  {selected.size === filteredActivities.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredActivities.map((activity, index) => {
                  const track = activity.origin;
                  const isSelected = selected.has(track.id);
                  const isRepost = activity.type.includes('repost');
                  let subtitle = `${track.user?.username || "Unknown"} • ${formatDuration(track.duration)}`;
                  
                  if (isRepost && activity.reposter) {
                    // Extract numeric ID or username from URN if possible, or just show "Reposted"
                    const reposterMatch = activity.reposter.match(/:(\d+)$/);
                    const reposterId = reposterMatch ? reposterMatch[1] : activity.reposter;
                    subtitle += ` • Reposted by ${reposterId}`;
                  } else if (isRepost) {
                    subtitle += ` • Reposted`;
                  }

                  return (
                    <TrackRow
                      key={track.id}
                      track={{
                        ...track,
                        subtitle,
                      }}
                      isSelected={isSelected}
                      onToggle={(e) => toggleTrack(track.id, index, filteredActivities, e)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Save panel */}
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border h-fit sticky top-24">
              <h2 className="text-lg font-bold text-[#333333] dark:text-foreground mb-4">
                Save to Playlist
              </h2>
              <p className="text-sm text-[#666666] dark:text-muted-foreground mb-4">
                {selected.size} track{selected.size !== 1 ? "s" : ""} selected
              </p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMode("new")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    mode === "new" ? "bg-[#FF5500] text-white" : "bg-gray-100 dark:bg-secondary/50 text-[#666666] dark:text-muted-foreground"
                  }`}
                >
                  New Playlist
                </button>
                <button
                  onClick={() => setMode("existing")}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    mode === "existing" ? "bg-[#FF5500] text-white" : "bg-gray-100 dark:bg-secondary/50 text-[#666666] dark:text-muted-foreground"
                  }`}
                >
                  Existing
                </button>
              </div>

              {mode === "new" ? (
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name (optional)"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none mb-4"
                />
              ) : (
                <select
                  value={selectedPlaylistId || ""}
                  onChange={(e) => setSelectedPlaylistId(Number(e.target.value))}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none mb-4"
                >
                  <option value="">Choose a playlist...</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.title} ({pl.track_count} tracks)
                    </option>
                  ))}
                </select>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || selected.size === 0 || (mode === "existing" && !selectedPlaylistId)}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SquarePlus className="w-4 h-4" />
                    Save to Playlist
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
    </PageContainer>
  );
}
