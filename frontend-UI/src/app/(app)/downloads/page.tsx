"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Heart, ListMusic, Trash2, X, CheckSquare, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, ConfirmDialog, EmptyState, Input, LoadingSpinner, TrackRow } from "@/components/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string;
  kind?: "playlist";
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
  permalink_url: string;
}

const LIKED_TRACKS_ID = -1;

export default function DownloadsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSource, setSelectedSource] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);

  // Confirmation dialog + inline error
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaylists();
    fetchLikesCount();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await apiFetch("/api/playlists");
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

  const fetchLikesCount = async () => {
    try {
      const response = await apiFetch("/api/me");
      if (response.ok) {
        const data = await response.json();
        setLikesCount(data.public_favorites_count ?? data.likes_count ?? null);
      }
    } catch {
      // non-critical — card just shows "All your likes"
    }
  };

  const fetchTracks = async (source: Playlist) => {
    setLoadingTracks(true);
    setTracks([]);
    try {
      const endpoint =
        source.id === LIKED_TRACKS_ID
          ? "/api/likes"
          : `/api/playlists/${source.id}`;
      const response = await apiFetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setTracks(
          source.id === LIKED_TRACKS_ID ? data.collection || [] : data.tracks || []
        );
      }
    } catch (error) {
      console.error("Failed to fetch tracks:", error);
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleSelectSource = (p: Playlist) => {
    setSelectedSource(p);
    fetchTracks(p);
    setSelectionMode(false);
    setSelectedTrackIds(new Set());
    setInlineError(null);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedTrackIds(new Set());
    setInlineError(null);
  };

  const toggleTrackSelection = (id: number) => {
    const newSelected = new Set(selectedTrackIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTrackIds(newSelected);
  };

  const handleRemoveSelected = () => {
    if (!selectedSource || selectedSource.id === LIKED_TRACKS_ID || selectedTrackIds.size === 0) return;

    const remainingCount = tracks.filter((t) => !selectedTrackIds.has(t.id)).length;
    if (remainingCount === 0) {
      setInlineError("Cannot remove all tracks from a playlist. Delete the playlist on SoundCloud instead.");
      return;
    }

    setShowRemoveConfirm(true);
  };

  const executeRemove = async () => {
    if (!selectedSource) return;
    setShowRemoveConfirm(false);
    setInlineError(null);

    const remainingTracks = tracks.filter((t) => !selectedTrackIds.has(t.id));
    const remainingIds = remainingTracks.map((t) => t.id);

    setIsRemoving(true);
    try {
      const response = await apiFetch(`/api/playlists/${selectedSource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: remainingIds }),
      });

      if (response.ok) {
        setTracks(remainingTracks);
        setSelectedTrackIds(new Set());
        setSelectionMode(false);
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === selectedSource.id
              ? { ...p, track_count: remainingTracks.length }
              : p
          )
        );
      } else {
        setInlineError("Failed to update playlist. Please try again.");
      }
    } catch (error) {
      console.error("Failed to remove tracks:", error);
      setInlineError("An error occurred while removing tracks.");
    } finally {
      setIsRemoving(false);
    }
  };

  const downloadableTracks = tracks.filter(
    (t) => Boolean(t.downloadable) || t.downloadable === "true" || !!t.download_url || !!t.purchase_url
  );

  const filteredPlaylists = playlists.filter((p) =>
    p.title.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2] dark:bg-background">
      <div className="container mx-auto px-6 py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="lg:hidden inline-flex items-center gap-2 text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-[#333333] dark:text-foreground">
            Downloads
          </h1>
          <p className="text-sm text-[#666666] dark:text-muted-foreground">
            Find downloadable tracks in your library.
          </p>
        </div>

        {!selectedSource ? (
          /* Source Selection */
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
              Select Source
            </h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* Search filter */}
                {playlists.length > 5 && (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999] dark:text-muted-foreground" />
                    <Input
                      type="text"
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      placeholder="Search playlists…"
                      className="pl-9 h-9 bg-transparent dark:text-foreground dark:border-border"
                    />
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Liked Tracks — always shown */}
                  <button
                    onClick={() =>
                      handleSelectSource({
                        id: LIKED_TRACKS_ID,
                        title: "Liked Tracks",
                        track_count: likesCount ?? 0,
                        artwork_url: "",
                        kind: "playlist",
                      })
                    }
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-[#FF5500] transition-all text-left"
                  >
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white shrink-0">
                      <Heart className="w-8 h-8" fill="currentColor" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#333333] dark:text-foreground">
                        Liked Tracks
                      </div>
                      <div className="text-sm text-[#666666] dark:text-muted-foreground">
                        {likesCount !== null
                          ? `${likesCount.toLocaleString()} liked tracks`
                          : "All your likes"}
                      </div>
                    </div>
                  </button>

                  {filteredPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handleSelectSource(playlist)}
                      className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-[#FF5500] transition-all text-left"
                    >
                      <img
                        src={playlist.coverUrl || playlist.artwork_url || "/SC Toolkit Icon.png"}
                        alt={playlist.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
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

                  {sourceSearch && filteredPlaylists.length === 0 && (
                    <div className="md:col-span-2">
                      <EmptyState
                        title="No playlists match your search"
                        description="Try a different keyword."
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Track List */
          <div>
            <button
              onClick={() => {
                setSelectedSource(null);
                setTracks([]);
                setInlineError(null);
              }}
              className="text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sources
            </button>

            <h2 className="text-2xl font-bold text-[#333333] dark:text-foreground mb-6 flex items-center gap-3">
              {selectedSource.id === LIKED_TRACKS_ID ? (
                <Heart className="w-6 h-6 text-[#FF5500]" fill="currentColor" />
              ) : (
                <ListMusic className="w-6 h-6" />
              )}
              {selectedSource.title}
              <span className="text-lg font-normal text-[#666666] dark:text-muted-foreground ml-2">
                ({downloadableTracks.length} downloadable)
              </span>
            </h2>

            {/* Inline error */}
            {inlineError && (
              <div className="flex items-start gap-3 mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg px-4 py-3">
                <span className="flex-1">{inlineError}</span>
                <button onClick={() => setInlineError(null)} className="shrink-0 hover:opacity-70 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Toolbar */}
            {selectedSource.id !== LIKED_TRACKS_ID && downloadableTracks.length > 0 && (
              <div className="flex items-center gap-4 mb-6">
                {!selectionMode ? (
                  <Button
                    onClick={toggleSelectionMode}
                    variant="secondary"
                    className="h-10 px-4 text-[#666666] dark:text-muted-foreground"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Select to Remove
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={toggleSelectionMode}
                      variant="secondary"
                      className="h-10 px-4 text-[#666666] dark:text-muted-foreground"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleRemoveSelected}
                      disabled={selectedTrackIds.size === 0 || isRemoving}
                      variant="destructive"
                      className="h-10 px-4"
                    >
                      {isRemoving ? (
                        <LoadingSpinner className="w-4 h-4 text-white" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Remove ({selectedTrackIds.size})
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              {loadingTracks ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 bg-gray-100 dark:bg-secondary/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : downloadableTracks.length === 0 ? (
                <EmptyState
                  icon={<Download className="w-12 h-12" />}
                  title="No downloadable tracks found"
                  description="Try another playlist or source."
                />
              ) : (
                <div className="space-y-2">
                  {downloadableTracks.map((track, index) => {
                    const downloadHref = track.download_url
                      ? `${API_BASE}/api/proxy-download?url=${encodeURIComponent(track.download_url)}`
                      : track.purchase_url || track.permalink_url;

                    if (selectionMode) {
                      return (
                        <TrackRow
                          key={track.id}
                          track={{ ...track, subtitle: track.user?.username }}
                          isSelected={selectedTrackIds.has(track.id)}
                          onToggle={() => toggleTrackSelection(track.id)}
                          rightSlot={
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#666666] dark:text-muted-foreground">
                                {formatDuration(track.duration)}
                              </span>
                              <a
                                href={downloadHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`rounded-lg p-2 text-white transition ${
                                  track.download_url
                                    ? "bg-green-500 hover:bg-green-600"
                                    : "bg-[#FF5500] hover:bg-[#E64D00]"
                                }`}
                                title={
                                  track.download_url
                                    ? "Download directly"
                                    : track.purchase_url
                                    ? "Go to download/buy"
                                    : "Go to track"
                                }
                              >
                                <Download className="h-5 w-5" />
                              </a>
                            </div>
                          }
                        />
                      );
                    }

                    return (
                      <div
                        key={track.id}
                        className="group flex items-center gap-4 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-secondary/20 dark:hover:bg-secondary/40"
                      >
                        <span className="w-8 text-center text-sm text-[#999999] dark:text-muted-foreground">
                          {index + 1}
                        </span>
                        <img
                          src={track.artwork_url || "/SC Toolkit Icon.png"}
                          alt={track.title}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-[#333333] dark:text-foreground">
                            {track.title}
                          </div>
                          <div className="truncate text-sm text-[#666666] dark:text-muted-foreground">
                            {track.user?.username} • {formatDuration(track.duration)}
                          </div>
                        </div>
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`rounded-lg p-2 text-white transition ${
                            track.download_url
                              ? "bg-green-500 hover:bg-green-600"
                              : "bg-[#FF5500] hover:bg-[#E64D00]"
                          }`}
                          title={
                            track.download_url
                              ? "Download directly"
                              : track.purchase_url
                              ? "Go to download/buy"
                              : "Go to track"
                          }
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove tracks?"
        description={`Remove ${selectedTrackIds.size} track${selectedTrackIds.size !== 1 ? "s" : ""} from "${selectedSource?.title}"? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={executeRemove}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </div>
  );
}
