"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shuffle, Save, ArrowUpDown, Trash2, Music, Download, ExternalLink } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string; // Backend computed fallback
}

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
  downloadable?: boolean | string;
  download_url?: string;
  purchase_url?: string;
  purchase_title?: string;
}

type TrackFilter = "all" | "downloadable" | "buylink";

export default function PlaylistModifierPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");

  const filteredTracks = tracks.filter((t) => {
    if (trackFilter === "downloadable") return Boolean(t.downloadable) || t.downloadable === "true";
    if (trackFilter === "buylink") return !!t.purchase_url;
    return true;
  });

  const downloadCount = tracks.filter((t) => Boolean(t.downloadable) || t.downloadable === "true").length;
  const buyLinkCount = tracks.filter((t) => !!t.purchase_url).length;

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
    fetchTracks(playlist.id);
  };

  const removeTrack = (trackId: number) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const moveTrack = (index: number, direction: "up" | "down") => {
    const newTracks = [...tracks];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tracks.length) return;
    [newTracks[index], newTracks[newIndex]] = [
      newTracks[newIndex],
      newTracks[index],
    ];
    setTracks(newTracks);
  };

  const shuffleTracks = () => {
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setTracks(shuffled);
  };

  const savePlaylist = async () => {
    if (!selectedPlaylist) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/playlists/${selectedPlaylist.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tracks: tracks.map((t) => t.id) }),
        }
      );
      if (response.ok) {
        alert("Playlist saved successfully!");
      } else {
        alert("Failed to save playlist");
      }
    } catch (error) {
      console.error("Error saving playlist:", error);
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
            Playlist Modifier
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Reorder, remove, and reorganize tracks in your playlists.
          </p>
        </div>

        {!selectedPlaylist ? (
          /* Playlist Selection */
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
              Select a Playlist to Modify
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
                      src={playlist.coverUrl || playlist.artwork_url || "/SC Toolkit Icon.png"}
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
          /* Track Editor */
          <div>
            <div className="flex items-center justify-between mb-6">
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
              <div className="flex gap-3">
                <button
                  onClick={shuffleTracks}
                  className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-border hover:border-[#FF5500] transition flex items-center gap-2 text-[#333333] dark:text-foreground"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle
                </button>
                <button
                  onClick={savePlaylist}
                  disabled={saving}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <LoadingSpinner size="sm" className="w-4 h-4 border-white" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              {/* Filter pills */}
              {!loadingTracks && tracks.length > 0 && (
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {([
                    { key: "all" as TrackFilter, label: "All", count: tracks.length },
                    { key: "downloadable" as TrackFilter, label: "⬇ Downloadable", count: downloadCount },
                    { key: "buylink" as TrackFilter, label: "🔗 Buy Link", count: buyLinkCount },
                  ]).map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setTrackFilter(key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        trackFilter === key
                          ? "bg-[#FF5500] text-white"
                          : "bg-gray-100 dark:bg-secondary/20 text-[#666666] dark:text-muted-foreground hover:bg-gray-200 dark:hover:bg-secondary/40"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              )}
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
                  icon={<Music className="w-12 h-12" />}
                  title="No tracks match this filter"
                  description="Try a different filter."
                />
              ) : (
                <div className="space-y-2">
                  {filteredTracks.map((track, index) => {
                    const globalIndex = tracks.indexOf(track);
                    return (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-secondary/20 group"
                    >
                      <span className="w-8 text-center text-sm text-[#999999] dark:text-muted-foreground">
                        {globalIndex + 1}
                      </span>
                      <img
                        src={track.artwork_url || "/SC Toolkit Icon.png"}
                        alt={track.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#333333] dark:text-foreground truncate flex items-center gap-2">
                          {track.title}
                          {(Boolean(track.downloadable) || track.downloadable === "true") && track.download_url && (
                            <a 
                              href={track.download_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Download track" 
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium flex-shrink-0 hover:bg-green-200 dark:hover:bg-green-900/50 transition"
                            >
                              <Download className="w-3 h-3" /> DL
                            </a>
                          )}
                          {(Boolean(track.downloadable) || track.downloadable === "true") && !track.download_url && (
                            <span title="Downloadable (no direct link)" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium flex-shrink-0">
                              <Download className="w-3 h-3" /> DL
                            </span>
                          )}
                          {track.purchase_url && (
                            <a
                              href={track.purchase_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={track.purchase_title || "Buy / External link"}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium flex-shrink-0 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
                            >
                              <ExternalLink className="w-3 h-3" /> {track.purchase_title || "Buy"}
                            </a>
                          )}
                        </div>
                        <div className="text-sm text-[#666666] dark:text-muted-foreground truncate">
                          {track.user?.username} •{" "}
                          {formatDuration(track.duration)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => moveTrack(globalIndex, "up")}
                          disabled={globalIndex === 0}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-secondary/40 rounded disabled:opacity-30"
                        >
                          <ArrowUpDown className="w-4 h-4 rotate-180" />
                        </button>
                        <button
                          onClick={() => moveTrack(globalIndex, "down")}
                          disabled={globalIndex === tracks.length - 1}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-secondary/40 rounded disabled:opacity-30"
                        >
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeTrack(track.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
