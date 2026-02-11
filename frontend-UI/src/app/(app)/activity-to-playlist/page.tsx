"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, Music, Loader2, Search, SquarePlus, Check } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

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
  origin: Track;
}

interface Playlist {
  id: number;
  title: string;
  track_count: number;
}

export default function ActivityToPlaylistPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [actRes, plRes] = await Promise.all([
        fetch(`${API_BASE}/api/activities?limit=200`, { credentials: "include" }),
        fetch(`${API_BASE}/api/playlists`, { credentials: "include" }),
      ]);

      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData.collection || []);
      }
      if (plRes.ok) {
        const plData = await plRes.json();
        setPlaylists(plData.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
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
    setSuccess(false);

    try {
      const trackIds = Array.from(selected);

      if (mode === "new") {
        const title = newPlaylistName.trim() || `Activity Tracks ${new Date().toLocaleDateString()}`;
        const response = await fetch(`${API_BASE}/api/playlists/from-likes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ trackIds, title }),
        });
        if (response.ok) {
          setSuccess(true);
          setSelected(new Set());
        } else {
          alert("Failed to create playlist");
        }
      } else if (selectedPlaylistId) {
        // Get existing tracks and append
        const plRes = await fetch(`${API_BASE}/api/playlists/${selectedPlaylistId}`, { credentials: "include" });
        if (plRes.ok) {
          const plData = await plRes.json();
          const existingIds = (plData.tracks || []).map((t: Track) => t.id);
          const mergedIds = [...existingIds, ...trackIds];
          const response = await fetch(`${API_BASE}/api/playlists/${selectedPlaylistId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tracks: mergedIds }),
          });
          if (response.ok) {
            setSuccess(true);
            setSelected(new Set());
          } else {
            alert("Failed to update playlist");
          }
        }
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("An error occurred");
    } finally {
      setSaving(false);
    }
  };

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
            Activity → Playlist
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Select tracks from your activity feed and save them to a playlist.
          </p>
        </div>

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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Track list */}
            <div className="lg:col-span-2 bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999] dark:text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tracks..."
                    className="w-full pl-10 pr-3 py-2 border-2 border-gray-200 dark:border-border rounded-lg text-sm text-[#333333] dark:text-foreground bg-gray-50 dark:bg-secondary/20 focus:border-[#FF5500] focus:outline-none"
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
                {filteredActivities.map((activity) => {
                  const track = activity.origin;
                  const isSelected = selected.has(track.id);
                  return (
                    <button
                      key={track.id}
                      onClick={() => toggleTrack(track.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                        isSelected
                          ? "bg-[#FF5500]/10 border-2 border-[#FF5500]/30"
                          : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-[#FF5500] text-white" : "bg-gray-200 dark:bg-secondary"
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

            {/* Save panel */}
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border h-fit sticky top-6">
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

              {success && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 text-sm text-green-700 dark:text-green-400">
                  ✓ Playlist saved successfully!
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || selected.size === 0 || (mode === "existing" && !selectedPlaylistId)}
                className="w-full px-4 py-2.5 rounded-lg bg-[#FF5500] text-white font-semibold hover:bg-[#E64D00] transition disabled:opacity-50 flex items-center justify-center gap-2"
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
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
