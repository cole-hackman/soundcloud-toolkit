"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, X, Combine, Check, Music } from "lucide-react";
import { EmptyState, LoadingSpinner } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string;
}

export default function CombinePlaylistsPage() {
  const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    playlists?: { title: string }[];
    playlist?: { title: string };
    stats?: { totalTracks?: number; finalCount?: number; uniqueBeforeCap?: number };
    totalTracks?: number;
  } | null>(null);

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
        setUserPlaylists(data.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistToggle = (playlist: Playlist) => {
    const idNum = Number(playlist.id);
    setSelectedPlaylists((prev) =>
      prev.find((p) => Number(p.id) === idNum)
        ? prev.filter((p) => Number(p.id) !== idNum)
        : [...prev, { ...playlist, id: idNum }]
    );
  };

  const handleCombine = async () => {
    if (selectedPlaylists.length < 2 || !newPlaylistTitle.trim()) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/api/playlists/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourcePlaylistIds: selectedPlaylists.map((p) => p.id),
          title: newPlaylistTitle,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setIsComplete(true);
      } else {
        const error = await response.json();
        console.error("Failed to merge playlists:", error);
        alert("Failed to merge playlists");
      }
    } catch (error) {
      console.error("Error merging playlists:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalTracks = selectedPlaylists.reduce(
    (sum, playlist) => sum + (playlist.track_count || 0),
    0
  );

  if (isComplete) {
    const playlists =
      result?.playlists || (result?.playlist ? [result.playlist] : []);
    const numPlaylists = playlists.length;
    const totalTracksCreated =
      result?.stats?.totalTracks ||
      result?.stats?.finalCount ||
      result?.totalTracks ||
      0;

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#F2F2F2] dark:bg-background">
        <div className="max-w-2xl w-full">
          <div className="text-center rounded-2xl p-10 shadow-xl border-2 bg-white dark:bg-card border-gray-200 dark:border-border">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">
              {numPlaylists > 1
                ? `${numPlaylists} Playlists Created!`
                : "Playlist Created!"}
            </h1>
            <p className="text-lg mb-8 leading-relaxed text-[#666666] dark:text-muted-foreground">
              {numPlaylists > 1 ? (
                <>
                  Split into {numPlaylists} playlists (500 tracks each).
                </>
              ) : (
                <>
                  &quot;{playlists[0]?.title || newPlaylistTitle}&quot; has been
                  created with {totalTracksCreated} tracks (duplicates removed)
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="px-8 py-3 rounded-lg font-semibold transition-all bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={() => {
                  setIsComplete(false);
                  setSelectedPlaylists([]);
                  setNewPlaylistTitle("");
                  setResult(null);
                }}
                className="px-8 py-3 rounded-lg font-semibold transition-all border-2 border-gray-200 dark:border-border text-[#333333] dark:text-foreground hover:border-[#FF5500]"
              >
                Merge More Playlists
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
            Combine Playlists
          </h1>
          <p className="text-lg text-[#666666] dark:text-muted-foreground">
            Select playlists to merge into one. Duplicates will be
            automatically removed.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Playlist Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
                Your Playlists
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
                ) : userPlaylists.length === 0 ? (
                  <EmptyState
                    icon={<Music className="w-12 h-12" />}
                    title="No playlists found"
                    description="Create some playlists on SoundCloud first."
                  />
                ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {userPlaylists.map((playlist) => {
                    const isSelected = selectedPlaylists.some(
                      (p) => Number(p.id) === Number(playlist.id)
                    );
                    return (
                      <button
                        key={playlist.id}
                        onClick={() => handlePlaylistToggle(playlist)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                          isSelected
                            ? "bg-[#FF5500]/10 border-2 border-[#FF5500]"
                            : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                        }`}
                      >
                        <img
                          src={
                            playlist.artwork_url ||
                            playlist.coverUrl ||
                            "/SC Toolkit Icon.png"
                          }
                          alt={playlist.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-[#333333] dark:text-foreground">
                            {playlist.title}
                          </div>
                          <div className="text-sm text-[#666666] dark:text-muted-foreground">
                            {playlist.track_count} tracks
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center">
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

          {/* Merge Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border sticky top-24">
              <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
                Merge Settings
              </h2>

              {/* Selected Playlists */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                  Selected ({selectedPlaylists.length})
                </label>
                {selectedPlaylists.length === 0 ? (
                  <p className="text-sm text-[#999999] dark:text-muted-foreground py-4 text-center border-2 border-dashed border-gray-200 dark:border-border rounded-lg">
                    Select at least 2 playlists
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedPlaylists.map((playlist) => (
                      <div
                        key={playlist.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-secondary/20 rounded-lg"
                      >
                        <span className="text-sm truncate flex-1 text-[#333333] dark:text-foreground">
                          {playlist.title}
                        </span>
                        <button
                          onClick={() => handlePlaylistToggle(playlist)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-secondary/50 rounded"
                        >
                          <X className="w-4 h-4 text-[#666666] dark:text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Tracks */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                <div className="text-sm text-[#666666] dark:text-muted-foreground">Total Tracks</div>
                <div className="text-2xl font-bold text-[#333333] dark:text-foreground">
                  {totalTracks}
                </div>
                {totalTracks > 500 && (
                  <p className="text-xs text-[#FF5500] mt-1">
                    Will be split into multiple playlists (500 max each)
                  </p>
                )}
              </div>

              {/* New Playlist Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                  New Playlist Name
                </label>
                <input
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground"
                />
              </div>

              {/* Merge Button */}
              <button
                onClick={handleCombine}
                disabled={
                  selectedPlaylists.length < 2 ||
                  !newPlaylistTitle.trim() ||
                  isProcessing
                }
                className="w-full py-4 rounded-lg font-semibold transition-all bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <LoadingSpinner size="sm" className="border-white" />
                    Merging...
                  </>
                ) : (
                  <>
                    <Combine className="w-5 h-5" />
                    Merge Playlists
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
