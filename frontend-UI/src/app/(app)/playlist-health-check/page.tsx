"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Stethoscope, Music, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
}

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  access?: string;
}

type HealthFilter = "all" | "healthy" | "issues";

export default function PlaylistHealthCheckPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<HealthFilter>("all");

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/playlists`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracks = async (playlistId: number) => {
    setLoadingTracks(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/playlists/${playlistId}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setTracks(data.tracks || []);
      }
    } catch (error) {
      console.error("Failed to fetch tracks:", error);
    } finally {
      setLoadingTracks(false);
    }
  };

  const selectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setFilter("all");
    fetchTracks(playlist.id);
  };

  const getTrackStatus = (track: Track): { label: string; color: string; bg: string; icon: "ok" | "warn" | "bad" } => {
    if (!track.access || track.access === "playable") {
      return { label: "Playable", color: "text-green-700", bg: "bg-green-100", icon: "ok" };
    }
    if (track.access === "preview") {
      return { label: "Preview Only", color: "text-yellow-700", bg: "bg-yellow-100", icon: "warn" };
    }
    return { label: "Blocked", color: "text-red-700", bg: "bg-red-100", icon: "bad" };
  };

  const isHealthy = (track: Track) => !track.access || track.access === "playable";
  const healthyCount = tracks.filter(isHealthy).length;
  const issueCount = tracks.length - healthyCount;
  const healthPercent = tracks.length > 0 ? Math.round((healthyCount / tracks.length) * 100) : 100;

  const filteredTracks = tracks.filter((t) => {
    if (filter === "healthy") return isHealthy(t);
    if (filter === "issues") return !isHealthy(t);
    return true;
  });

  const removeDeadTracks = async () => {
    if (!selectedPlaylist) return;
    const healthyTracks = tracks.filter(isHealthy);
    if (healthyTracks.length === tracks.length) return;

    if (!confirm(`Remove ${issueCount} unavailable track${issueCount > 1 ? "s" : ""} from "${selectedPlaylist.title}"?`)) return;

    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/playlists/${selectedPlaylist.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tracks: healthyTracks.map((t) => t.id) }),
        }
      );
      if (response.ok) {
        setTracks(healthyTracks);
        alert(`Removed ${issueCount} unavailable tracks.`);
      } else {
        alert("Failed to update playlist");
      }
    } catch (error) {
      console.error("Error updating playlist:", error);
      alert("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
      <div className="container mx-auto px-6 py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">
            Playlist Health Check
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Scan your playlists for blocked, preview-only, or unavailable tracks.
          </p>
        </div>

        {!selectedPlaylist ? (
          /* Playlist Selection */
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
              Select a Playlist to Scan
            </h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            ) : playlists.length === 0 ? (
              <EmptyState
                icon={<Music className="w-12 h-12" />}
                title="No playlists found"
              />
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => selectPlaylist(playlist)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-[#FF5500] transition-all text-left"
                  >
                    <img
                      src={playlist.artwork_url || "/SC Toolkit Icon.png"}
                      alt={playlist.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <div className="font-semibold text-[#333333] dark:text-foreground">
                        {playlist.title}
                      </div>
                      <div className="text-sm text-[#666666] dark:text-muted-foreground">
                        {playlist.track_count} tracks
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Health Check Results */
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setSelectedPlaylist(null);
                    setTracks([]);
                  }}
                  className="text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition"
                >
                  ← Back to playlists
                </button>
                <h2 className="text-2xl font-bold text-[#333333] dark:text-foreground">
                  {selectedPlaylist.title}
                </h2>
              </div>
              {issueCount > 0 && (
                <button
                  onClick={removeDeadTracks}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <LoadingSpinner size="sm" className="w-4 h-4 border-white" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove {issueCount} Dead Track{issueCount > 1 ? "s" : ""}
                </button>
              )}
            </div>

            {/* Summary bar */}
            {!loadingTracks && tracks.length > 0 && (
              <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-5 h-5 text-[#666666] dark:text-muted-foreground" />
                    <span className="font-semibold text-[#333333] dark:text-foreground">
                      {healthyCount} of {tracks.length} tracks healthy
                    </span>
                  </div>
                  <span className={`text-lg font-bold ${healthPercent === 100 ? "text-green-600 dark:text-green-500" : healthPercent >= 80 ? "text-yellow-600 dark:text-yellow-500" : "text-red-600 dark:text-red-500"}`}>
                    {healthPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-secondary/50 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${healthPercent === 100 ? "bg-green-500" : healthPercent >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${healthPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Filter pills */}
            {!loadingTracks && tracks.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                {([
                  { key: "all" as HealthFilter, label: "All", count: tracks.length },
                  { key: "healthy" as HealthFilter, label: "🟢 Healthy", count: healthyCount },
                  { key: "issues" as HealthFilter, label: "⚠️ Issues", count: issueCount },
                ]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filter === key
                        ? "bg-[#FF5500] text-white"
                        : "bg-gray-100 dark:bg-secondary/20 text-[#666666] dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-secondary/40"
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              {loadingTracks ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : tracks.length === 0 ? (
                <EmptyState
                  icon={<Music className="w-12 h-12" />}
                  title="This playlist has no tracks"
                />
              ) : filteredTracks.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle className="w-12 h-12" />}
                  title={filter === "issues" ? "No issues found!" : "No tracks match this filter"}
                  description={filter === "issues" ? "All tracks in this playlist are playable." : undefined}
                />
              ) : (
                <div className="space-y-2">
                  {filteredTracks.map((track, index) => {
                    const status = getTrackStatus(track);
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-4 p-3 rounded-xl ${status.icon === "bad" ? "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30" : status.icon === "warn" ? "bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30" : "bg-gray-50 dark:bg-secondary/20 border border-transparent dark:border-border"}`}
                      >
                        <span className="w-8 text-center text-sm text-[#999999] dark:text-muted-foreground">
                          {index + 1}
                        </span>
                        <img
                          src={track.artwork_url || "/SC Toolkit Icon.png"}
                          alt={track.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#333333] dark:text-foreground truncate">
                            {track.title}
                          </div>
                          <div className="text-sm text-[#666666] dark:text-muted-foreground truncate">
                            {track.user?.username} • {formatDuration(track.duration)}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} flex-shrink-0`}>
                          {status.icon === "ok" && <CheckCircle className="w-3.5 h-3.5" />}
                          {status.icon === "warn" && <AlertTriangle className="w-3.5 h-3.5" />}
                          {status.icon === "bad" && <AlertTriangle className="w-3.5 h-3.5" />}
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
