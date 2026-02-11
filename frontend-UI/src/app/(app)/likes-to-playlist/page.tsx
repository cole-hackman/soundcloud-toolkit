"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Music } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
}

interface CreatedPlaylist {
  id: number;
  title: string;
  permalink_url: string;
  trackCount: number;
}

export default function LikesToPlaylistPage() {
  const [likes, setLikes] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [playlistName, setPlaylistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<{
    playlist?: { id: number; title: string; permalink_url: string };
    playlists?: CreatedPlaylist[];
    totalTracks?: number;
    numPlaylistsCreated?: number;
  } | null>(null);

  useEffect(() => {
    fetchLikes();
  }, []);

  const fetchLikes = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/likes`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setLikes(data.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch likes:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (id: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedTracks.size === likes.length) {
      setSelectedTracks(new Set());
    } else {
      setSelectedTracks(new Set(likes.map((t) => t.id)));
    }
  };

  const createPlaylist = async () => {
    if (selectedTracks.size === 0 || !playlistName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE}/api/playlists/from-likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          trackIds: Array.from(selectedTracks),
          title: playlistName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResult(data);
        setSuccess(true);
      } else {
        const message = typeof data?.error === "string" ? data.error : "Failed to create playlist";
        alert(message);
      }
    } catch (error) {
      console.error("Error creating playlist:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (success && result) {
    const multiple = result.playlists && result.playlists.length > 1;
    return (

      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#F2F2F2] dark:bg-background">
        <div className="max-w-2xl w-full text-center">
          <div className="bg-white dark:bg-card rounded-2xl p-10 shadow-xl border-2 border-gray-200 dark:border-border">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4 text-[#333333] dark:text-foreground">
              {multiple ? "Playlists Created!" : "Playlist Created!"}
            </h1>
            <p className="text-lg mb-6 text-[#666666] dark:text-muted-foreground">
              {multiple
                ? `${result.totalTracks ?? selectedTracks.size} tracks across ${result.numPlaylistsCreated} playlists.`
                : `"${playlistName}" has been created with ${result.totalTracks ?? selectedTracks.size} tracks.`}
            </p>
            {multiple && result.playlists && (
              <div className="mb-6 space-y-2 text-left">
                {result.playlists.map((p) => (
                  <a
                    key={p.id}
                    href={p.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-border hover:border-[#FF5500] hover:bg-[#FF5500]/5 transition"
                  >
                    <span className="font-semibold text-[#333333] dark:text-foreground">{p.title}</span>
                    <span className="text-sm text-[#666666] dark:text-muted-foreground ml-2">({p.trackCount} tracks)</span>
                  </a>
                ))}
              </div>
            )}
            {!multiple && result.playlist?.permalink_url && (
              <div className="mb-6">
                <a
                  href={result.playlist.permalink_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 rounded-lg font-semibold bg-[#FF5500]/10 text-[#FF5500] hover:bg-[#FF5500]/20 transition"
                >
                  Open in SoundCloud
                </a>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="px-8 py-3 rounded-lg font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg transition"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => {
                  setSuccess(false);
                  setResult(null);
                  setSelectedTracks(new Set());
                  setPlaylistName("");
                }}
                className="px-8 py-3 rounded-lg font-semibold border-2 border-gray-200 dark:border-border text-[#333333] dark:text-foreground hover:border-[#FF5500] transition"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            Likes → Playlist
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Convert your liked tracks into an organized playlist.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Track List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">
                  Your Liked Tracks ({likes.length})
                </h2>
                <button
                  onClick={selectAll}
                  className="text-sm text-[#FF5500] hover:underline"
                >
                  {selectedTracks.size === likes.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : likes.length === 0 ? (
                <EmptyState
                  icon={<Music className="w-12 h-12" />}
                  title="No liked tracks found"
                />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {likes.map((track) => {
                    const isSelected = selectedTracks.has(track.id);
                    return (
                      <button
                        key={track.id}
                        onClick={() => toggleTrack(track.id)}
                        className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                          isSelected
                            ? "bg-[#FF5500]/10 border-2 border-[#FF5500]"
                            : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                        }`}
                      >
                        <img
                          src={track.artwork_url || "/SC Toolkit Icon.png"}
                          alt={track.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 text-left min-w-0">
                          <div className="font-semibold text-[#333333] dark:text-foreground truncate">
                            {track.title}
                          </div>
                          <div className="text-sm text-[#666666] dark:text-muted-foreground truncate">
                            {track.user?.username} •{" "}
                            {formatDuration(track.duration)}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Create Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border sticky top-24">
              <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
                Create Playlist
              </h2>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                <div className="text-sm text-[#666666] dark:text-muted-foreground">Selected Tracks</div>
                <div className="text-2xl font-bold text-[#333333] dark:text-foreground">
                  {selectedTracks.size}
                </div>
              </div>

              {selectedTracks.size > 500 && (
                <p className="mb-4 text-sm text-[#FF5500]">
                  Selection exceeds 500 tracks; multiple playlists will be created.
                </p>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground"
                />
              </div>

              <button
                onClick={createPlaylist}
                disabled={
                  selectedTracks.size === 0 ||
                  !playlistName.trim() ||
                  creating
                }
                className="w-full py-4 rounded-lg font-semibold transition-all bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <LoadingSpinner size="sm" className="border-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Playlist
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
