"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shuffle, Save, ArrowUpDown, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

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
}

export default function PlaylistModifierPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [saving, setSaving] = useState(false);

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
        `${API_BASE}/api/playlists/${playlistId}/tracks`,
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
        `${API_BASE}/api/playlists/${selectedPlaylist.id}/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ trackIds: tracks.map((t) => t.id) }),
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
    <AppLayout>
      <div className="min-h-screen bg-[#F2F2F2]">
        <div className="container mx-auto px-6 py-12 max-w-6xl">
          {/* Header */}
          <div className="mb-12">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-[#666666] hover:text-[#FF5500] transition mb-6"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333]">
              Playlist Modifier
            </h1>
            <p className="text-lg text-[#666666]">
              Reorder, remove, and reorganize tracks in your playlists.
            </p>
          </div>

          {!selectedPlaylist ? (
            /* Playlist Selection */
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
              <h2 className="text-xl font-bold mb-4 text-[#333333]">
                Select a Playlist to Modify
              </h2>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-100 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : playlists.length === 0 ? (
                <p className="text-[#666666] py-8 text-center">
                  No playlists found.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => selectPlaylist(playlist)}
                      className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border-2 border-transparent hover:border-[#FF5500] transition-all text-left"
                    >
                      <img
                        src={playlist.artwork_url || "/SC Toolkit Icon.png"}
                        alt={playlist.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div>
                        <div className="font-semibold text-[#333333]">
                          {playlist.title}
                        </div>
                        <div className="text-sm text-[#666666]">
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
                    className="text-[#666666] hover:text-[#FF5500] transition"
                  >
                    ← Back to playlists
                  </button>
                  <h2 className="text-2xl font-bold text-[#333333]">
                    {selectedPlaylist.title}
                  </h2>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={shuffleTracks}
                    className="px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-[#FF5500] transition flex items-center gap-2 text-[#333333]"
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
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
                {loadingTracks ? (
                  <div className="space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 bg-gray-100 rounded-lg animate-pulse"
                      />
                    ))}
                  </div>
                ) : tracks.length === 0 ? (
                  <p className="text-[#666666] py-8 text-center">
                    This playlist has no tracks.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tracks.map((track, index) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 group"
                      >
                        <span className="w-8 text-center text-sm text-[#999999]">
                          {index + 1}
                        </span>
                        <img
                          src={track.artwork_url || "/SC Toolkit Icon.png"}
                          alt={track.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#333333] truncate">
                            {track.title}
                          </div>
                          <div className="text-sm text-[#666666] truncate">
                            {track.user?.username} •{" "}
                            {formatDuration(track.duration)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => moveTrack(index, "up")}
                            disabled={index === 0}
                            className="p-2 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            <ArrowUpDown className="w-4 h-4 rotate-180" />
                          </button>
                          <button
                            onClick={() => moveTrack(index, "down")}
                            disabled={index === tracks.length - 1}
                            className="p-2 hover:bg-gray-200 rounded disabled:opacity-30"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeTrack(track.id)}
                            className="p-2 hover:bg-red-100 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

