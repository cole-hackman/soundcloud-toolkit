"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Plus, Music, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Button,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  ResultPanel,
  Skeleton,
  TrackRow,
} from "@/components/ui";

interface Track {
  id: number;
  title: string;
  user: { username: string };
  artwork_url: string;
  duration: number;
}

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string;
}

interface CreatedPlaylist {
  id: number;
  title: string;
  permalink_url: string;
  trackCount: number;
}

type AddMode = "new" | "existing";

export default function LikesToPlaylistPage() {
  const [prefillTrackId, setPrefillTrackId] = useState<number | null>(null);
  const [likes, setLikes] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [playlistName, setPlaylistName] = useState("");
  const [addMode, setAddMode] = useState<AddMode>("new");
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<{
    playlist?: { id: number; title: string; permalink_url: string };
    playlists?: CreatedPlaylist[];
    overflowPlaylists?: CreatedPlaylist[];
    totalTracks?: number;
    addedCount?: number;
    numPlaylistsCreated?: number;
  } | null>(null);

  useEffect(() => {
    fetchLikes();
  }, []);

  useEffect(() => {
    const idParam = new URLSearchParams(window.location.search).get("id");
    const trackId = idParam ? Number(idParam) : NaN;
    if (Number.isInteger(trackId)) setPrefillTrackId(trackId);
  }, []);

  useEffect(() => {
    if (prefillTrackId != null && likes.some((track) => track.id === prefillTrackId)) {
      setSelectedTracks(new Set([prefillTrackId]));
    }
  }, [likes, prefillTrackId]);

  // Fetch user playlists when switching to "existing" mode
  useEffect(() => {
    if (addMode === "existing" && userPlaylists.length === 0) {
      fetchUserPlaylists();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMode]);

  const fetchLikes = async () => {
    try {
      const response = await apiFetch("/api/likes");
      if (response.ok) {
        const data = await response.json();
        setLikes(data.collection || []);
      } else {
        setNotice({ type: "error", text: "Couldn’t load your liked tracks. Try refreshing the page." });
      }
    } catch (error) {
      console.error("Failed to fetch likes:", error);
      setNotice({ type: "error", text: "Couldn’t load your liked tracks. Try refreshing the page." });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPlaylists = async () => {
    setLoadingPlaylists(true);
    try {
      const response = await apiFetch("/api/playlists");
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.collection || []);
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const toggleTrack = (id: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const canCreate =
    selectedTracks.size > 0 &&
    (addMode === "existing" ? targetPlaylist !== null : playlistName.trim().length > 0);

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        trackIds: Array.from(selectedTracks),
      };
      if (addMode === "existing" && targetPlaylist) {
        body.targetPlaylistId = targetPlaylist.id;
      } else {
        body.title = playlistName.trim();
      }

      const response = await apiFetch("/api/playlists/from-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResult(data);
        setSuccess(true);
      } else {
        const message = typeof data?.error === "string" ? data.error : "Failed to create playlist";
        setNotice({ type: "error", text: message });
      }
    } catch (error) {
      console.error("Error creating playlist:", error);
      setNotice({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setCreating(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // ── SUCCESS SCREEN ──────────────────────────────────────────────────────────
  if (success && result) {
    const multiple = result.playlists && result.playlists.length > 1;
    const isExisting = addMode === "existing";

    return (
      <div className="flex items-center justify-center px-6 py-6">
        <div className="max-w-2xl w-full text-center">
          <ResultPanel tone="success" className="p-5">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              {isExisting ? "Tracks Added!" : multiple ? "Playlists Created!" : "Playlist Created!"}
            </h1>
            <p className="text-sm mb-6 text-muted-foreground">
              {isExisting ? (
                <>
                  Added {result.addedCount ?? selectedTracks.size} new track{(result.addedCount ?? 1) !== 1 ? "s" : ""} to &quot;{targetPlaylist?.title}&quot;.
                  {result.overflowPlaylists && result.overflowPlaylists.length > 0 &&
                    ` ${result.overflowPlaylists.length} overflow playlist(s) created for tracks beyond the 500-track limit.`}
                </>
              ) : multiple ? (
                `${result.totalTracks ?? selectedTracks.size} tracks across ${result.numPlaylistsCreated} playlists.`
              ) : (
                `"${playlistName}" has been created with ${result.totalTracks ?? selectedTracks.size} tracks.`
              )}
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
            {!multiple && !isExisting && result.playlist?.permalink_url && (
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
                  setTargetPlaylist(null);
                }}
                className="px-8 py-3 rounded-lg font-semibold border-2 border-gray-200 dark:border-border text-[#333333] dark:text-foreground hover:border-[#FF5500] transition"
              >
                {isExisting ? "Add More" : "Create Another"}
              </button>
            </div>
          </ResultPanel>
        </div>
      </div>
    );
  }

  // ── MAIN PAGE ───────────────────────────────────────────────────────────────
  return (
    <PageContainer maxWidth="wide">
        <PageHeader
          title="Likes → Playlist"
          description="Convert your liked tracks into an organized playlist."
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Track List */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">
                  Your Liked Tracks ({likes.length})
                </h2>
                <button onClick={selectAll} className="text-sm text-[#FF5500] hover:underline">
                  {selectedTracks.size === likes.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/50" />
                  ))}
                </div>
              ) : likes.length === 0 ? (
                <EmptyState icon={<Music className="w-12 h-12" />} title="No liked tracks found" />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {likes.map((track) => {
                    const isSelected = selectedTracks.has(track.id);
                    return (
                      <TrackRow
                        key={track.id}
                        track={{ ...track, subtitle: track.user?.username }}
                        isSelected={isSelected}
                        onToggle={() => toggleTrack(track.id)}
                        rightSlot={
                          <span className="text-xs text-[#666666] dark:text-muted-foreground">
                            {formatDuration(track.duration)}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Create Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border sticky top-24 space-y-5">
              <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">
                {addMode === "existing" ? "Add to Playlist" : "Create Playlist"}
              </h2>

              <div className="p-4 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                <div className="text-sm text-[#666666] dark:text-muted-foreground">Selected Tracks</div>
                <div className="text-2xl font-bold text-[#333333] dark:text-foreground">
                  {selectedTracks.size}
                </div>
              </div>

              {selectedTracks.size > 500 && addMode === "new" && (
                <p className="text-sm text-[#FF5500]">
                  Selection exceeds 500 tracks; multiple playlists will be created.
                </p>
              )}

              {/* Mode Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                  Add to
                </label>
                <div className="flex rounded-lg border-2 border-gray-200 dark:border-border overflow-hidden">
                  <button
                    onClick={() => setAddMode("new")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      addMode === "new"
                        ? "bg-[#FF5500] text-white"
                        : "text-[#666666] dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/20"
                    }`}
                  >
                    New playlist
                  </button>
                  <button
                    onClick={() => setAddMode("existing")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      addMode === "existing"
                        ? "bg-[#FF5500] text-white"
                        : "text-[#666666] dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/20"
                    }`}
                  >
                    Existing playlist
                  </button>
                </div>
              </div>

              {/* New Playlist Name (only in "new" mode) */}
              {addMode === "new" && (
                <div>
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
              )}

              {/* Target Playlist Picker (only in "existing" mode) */}
              {addMode === "existing" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                    Target Playlist
                  </label>
                  {loadingPlaylists ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-[#999999] dark:text-muted-foreground">
                      <LoadingSpinner size="sm" />
                      Loading playlists…
                    </div>
                  ) : userPlaylists.length === 0 ? (
                    <p className="text-sm text-[#999999] dark:text-muted-foreground py-3 text-center border-2 border-dashed border-gray-200 dark:border-border rounded-lg">
                      No playlists found
                    </p>
                  ) : targetPlaylist ? (
                    <button
                      onClick={() => setShowPlaylistPicker(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#FF5500]/10 border-2 border-[#FF5500] transition-all hover:bg-[#FF5500]/15 text-left"
                    >
                      <img
                        src={targetPlaylist.coverUrl || targetPlaylist.artwork_url || "/SC Toolkit Icon.png"}
                        alt={targetPlaylist.title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#333333] dark:text-foreground text-sm truncate">
                          {targetPlaylist.title}
                        </div>
                        <div className="text-xs text-[#666666] dark:text-muted-foreground">
                          {targetPlaylist.track_count} tracks
                        </div>
                      </div>
                      <span className="text-xs text-[#FF5500] font-medium shrink-0">Change</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowPlaylistPicker(true)}
                      className="w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-border text-sm text-[#999999] dark:text-muted-foreground hover:border-[#FF5500] hover:text-[#FF5500] transition-all text-center"
                    >
                      Choose a playlist…
                    </button>
                  )}
                </div>
              )}

              <Button
                onClick={handleCreate}
                disabled={!canCreate || creating}
                className="h-10 w-full px-4"
              >
                {creating ? (
                  <>
                    <LoadingSpinner size="sm" className="border-white" />
                    {addMode === "existing" ? "Adding..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    {addMode === "existing" ? "Add to Playlist" : "Create Playlist"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

      {/* ── PLAYLIST PICKER MODAL ──────────────────────────────────────────── */}
      {showPlaylistPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPlaylistPicker(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg bg-white dark:bg-card rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h3 className="text-xl font-bold text-[#333333] dark:text-foreground">
                Your Playlists
              </h3>
              <button
                onClick={() => setShowPlaylistPicker(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary/40 transition"
              >
                <X className="w-5 h-5 text-[#666666] dark:text-muted-foreground" />
              </button>
            </div>

            {/* Playlist list */}
            <div className="px-6 pb-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {userPlaylists.map((playlist) => {
                const isSelected = targetPlaylist && Number(targetPlaylist.id) === Number(playlist.id);
                return (
                  <button
                    key={playlist.id}
                    onClick={() => {
                      setTargetPlaylist(playlist);
                      setShowPlaylistPicker(false);
                    }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                      isSelected
                        ? "bg-[#FF5500]/10 border-2 border-[#FF5500]"
                        : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                    }`}
                  >
                    <img
                      src={playlist.coverUrl || playlist.artwork_url || "/SC Toolkit Icon.png"}
                      alt={playlist.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-semibold text-[#333333] dark:text-foreground truncate">
                        {playlist.title}
                      </div>
                      <div className="text-sm text-[#666666] dark:text-muted-foreground">
                        {playlist.track_count} tracks
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#FF5500] flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
