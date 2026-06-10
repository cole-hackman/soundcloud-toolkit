"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Heart, ListMusic, Trash2, X, CheckSquare, Search, Zap } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button, BulkReviewDetails, ConfirmDialog, EmptyState, Input, LoadingSpinner, PageContainer, PageHeader, TrackRow } from "@/components/ui";

const OWNER_USER_ID = "cmfxhbsop0000dp0crm6vnd18";

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

interface HypedditQueueItem {
  id: number;
  title: string;
  artist: string;
  hypedditUrl: string;
}

interface HypedditProgress {
  total: number;
  index: number;
  completed: number;
  failed: number;
  active: boolean;
}

const LIKED_TRACKS_ID = -1;

const isHypedditUrl = (url?: string) =>
  !!url && url.includes("hypeddit");

export default function DownloadsPage() {
  const { user } = useAuth();
  const isOwner = user?.id === OWNER_USER_ID;

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedSource, setSelectedSource] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");

  // Selection mode (remove from playlist)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [isRemoving, setIsRemoving] = useState(false);

  // Confirmation dialog + inline error
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [downloadingTrackId, setDownloadingTrackId] = useState<number | null>(null);

  // Hypeddit batch mode
  const [hypedditMode, setHypedditMode] = useState(false);
  const [selectedHypedditIds, setSelectedHypedditIds] = useState<Set<number>>(new Set());
  const [extInstalled, setExtInstalled] = useState(false);
  const [hypedditProgress, setHypedditProgress] = useState<HypedditProgress | null>(null);
  const [queueSent, setQueueSent] = useState(false);

  useEffect(() => {
    fetchPlaylists();
    fetchLikesCount();
  }, []);

  useEffect(() => {
    const urlParam = new URLSearchParams(window.location.search).get("url");
    if (urlParam) setSourceSearch(urlParam);
  }, []);

  // Detect extension and load persisted progress on mount
  useEffect(() => {
    setExtInstalled(localStorage.getItem("sc-toolkit-ext-installed") === "1.0");
    const saved = localStorage.getItem("sc-toolkit-hypeddit-progress");
    if (saved) {
      try { setHypedditProgress(JSON.parse(saved)); } catch { /* ignore */ }
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as HypedditProgress;
      setHypedditProgress(detail);
    };
    window.addEventListener("sc-toolkit-progress-update", handler);
    return () => window.removeEventListener("sc-toolkit-progress-update", handler);
  }, []);

  // Re-check extension presence whenever a source is selected
  useEffect(() => {
    if (selectedSource) {
      setExtInstalled(localStorage.getItem("sc-toolkit-ext-installed") === "1.0");
    }
  }, [selectedSource]);

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
    setHypedditMode(false);
    setSelectedTrackIds(new Set());
    setSelectedHypedditIds(new Set());
    setInlineError(null);
    setQueueSent(false);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setHypedditMode(false);
    setSelectedTrackIds(new Set());
    setSelectedHypedditIds(new Set());
    setInlineError(null);
  };

  const toggleHypedditMode = () => {
    setHypedditMode(!hypedditMode);
    setSelectionMode(false);
    setSelectedTrackIds(new Set());
    setSelectedHypedditIds(new Set());
    setQueueSent(false);
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

  const toggleHypedditSelection = (id: number) => {
    const newSelected = new Set(selectedHypedditIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedHypedditIds(newSelected);
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

  const sendToExtension = () => {
    const toQueue = hypedditTracks.filter(
      (t) => selectedHypedditIds.size === 0 || selectedHypedditIds.has(t.id)
    );
    const queue: HypedditQueueItem[] = toQueue.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.user?.username ?? "",
      hypedditUrl: t.purchase_url!,
    }));
    localStorage.setItem("sc-toolkit-hypeddit-queue", JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("sc-toolkit-queue-set", { detail: { queue } }));
    setQueueSent(true);
    setHypedditMode(false);
    setSelectedHypedditIds(new Set());
  };

  const dismissProgress = () => {
    localStorage.removeItem("sc-toolkit-hypeddit-progress");
    setHypedditProgress(null);
  };

  const downloadableTracks = tracks.filter(
    (t) => Boolean(t.downloadable) || t.downloadable === "true" || !!t.download_url || !!t.purchase_url
  );

  const hypedditTracks = downloadableTracks.filter((t) => isHypedditUrl(t.purchase_url));

  const filteredPlaylists = playlists.filter((p) =>
    p.title.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getDownloadLabel = (track: Track) => {
    if (track.download_url) return "Download directly";
    if (isHypedditUrl(track.purchase_url)) return "Hypeddit download";
    if (track.purchase_url) return track.purchase_title || "Go to download/buy";
    return "Open on SoundCloud";
  };

  const getDownloadTone = (track: Track) => {
    if (track.download_url) return "bg-green-500 hover:bg-green-600";
    if (isHypedditUrl(track.purchase_url)) return "bg-purple-600 hover:bg-purple-700";
    return "bg-[#FF5500] hover:bg-[#E64D00]";
  };

  const handleDownload = async (track: Track) => {
    setInlineError(null);

    if (!track.download_url) {
      window.open(track.purchase_url || track.permalink_url, "_blank", "noopener,noreferrer");
      return;
    }

    setDownloadingTrackId(track.id);
    try {
      const response = await apiFetch(
        `/api/proxy-download?format=json&url=${encodeURIComponent(track.download_url)}`
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.url) {
        setInlineError(
          data?.error ||
            "SoundCloud did not provide a valid download link for this track. Try opening it on SoundCloud."
        );
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to start download:", error);
      setInlineError("Could not start the download. Try again or open the track on SoundCloud.");
    } finally {
      setDownloadingTrackId(null);
    }
  };

  const hdActive = hypedditProgress?.active ?? false;
  const hdTotal = hypedditProgress?.total ?? 0;
  const hdCompleted = hypedditProgress?.completed ?? 0;
  const hdFailed = hypedditProgress?.failed ?? 0;
  const showProgressBanner = hdTotal > 0;

  return (
    <PageContainer maxWidth="default">
        <PageHeader
          title="Downloads"
          description="Find downloadable tracks in your library."
        />

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
                setHypedditMode(false);
                setSelectionMode(false);
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

            {/* Hypeddit progress banner (owner-only) */}
            {isOwner && showProgressBanner && (
              <div className="mb-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/30 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                    {hdActive
                      ? `Auto-downloading… ${hdCompleted}/${hdTotal}`
                      : `Done — ${hdCompleted}/${hdTotal}`}
                    {hdFailed > 0 && (
                      <span className="ml-2 text-red-500 dark:text-red-400">({hdFailed} failed)</span>
                    )}
                  </span>
                  <button
                    onClick={dismissProgress}
                    className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-200 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-1.5 rounded-full bg-purple-200 dark:bg-purple-900/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${hdTotal ? Math.round(((hdCompleted + hdFailed) / hdTotal) * 100) : 0}%` }}
                  />
                </div>
                {!extInstalled && (
                  <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                    Extension not detected — open the panel from the Chrome toolbar to control the download.
                  </p>
                )}
              </div>
            )}

            {/* Queue-sent confirmation (owner-only) */}
            {isOwner && queueSent && (
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 px-4 py-3 text-sm text-purple-800 dark:text-purple-300">
                <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Queue sent to extension. Open the SoundCloud Toolkit side panel from the Chrome toolbar
                  and click <strong>Start</strong> to begin downloading.
                </span>
                <button onClick={() => setQueueSent(false)} className="shrink-0 hover:opacity-70">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

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
            {downloadableTracks.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Remove-from-playlist mode (playlists only, not likes) */}
                {selectedSource.id !== LIKED_TRACKS_ID && !hypedditMode && (
                  !selectionMode ? (
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
                  )
                )}

                {/* Hypeddit batch mode (owner-only, only when Hypeddit tracks exist) */}
                {isOwner && hypedditTracks.length > 0 && !selectionMode && (
                  !hypedditMode ? (
                    <Button
                      onClick={toggleHypedditMode}
                      variant="secondary"
                      className="h-10 px-4 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900"
                    >
                      <Zap className="w-4 h-4" />
                      Auto-Download Hypeddit ({hypedditTracks.length})
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={toggleHypedditMode}
                        variant="secondary"
                        className="h-10 px-4 text-[#666666] dark:text-muted-foreground"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          setSelectedHypedditIds(new Set(hypedditTracks.map((t) => t.id)))
                        }
                        variant="secondary"
                        className="h-10 px-4 text-[#666666] dark:text-muted-foreground"
                      >
                        Select All ({hypedditTracks.length})
                      </Button>
                      {selectedHypedditIds.size > 0 && (
                        <Button
                          onClick={() => setSelectedHypedditIds(new Set())}
                          variant="secondary"
                          className="h-10 px-4 text-[#666666] dark:text-muted-foreground"
                        >
                          Deselect All
                        </Button>
                      )}
                      <Button
                        onClick={sendToExtension}
                        disabled={selectedHypedditIds.size === 0}
                        className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Zap className="w-4 h-4" />
                        Queue {selectedHypedditIds.size} track{selectedHypedditIds.size !== 1 ? "s" : ""}
                      </Button>
                      {!extInstalled && (
                        <span className="text-xs text-[#999999] dark:text-muted-foreground self-center">
                          SC Toolkit extension required
                        </span>
                      )}
                    </>
                  )
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
                    const isHypeddit = isHypedditUrl(track.purchase_url);

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
                              <button
                                type="button"
                                disabled={downloadingTrackId === track.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(track);
                                }}
                                className={`rounded-lg p-2 text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${getDownloadTone(track)}`}
                                title={getDownloadLabel(track)}
                              >
                                {downloadingTrackId === track.id ? (
                                  <LoadingSpinner className="h-5 w-5 text-white" />
                                ) : (
                                  <Download className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          }
                        />
                      );
                    }

                    if (hypedditMode && isHypeddit) {
                      return (
                        <TrackRow
                          key={track.id}
                          track={{ ...track, subtitle: track.user?.username }}
                          isSelected={selectedHypedditIds.has(track.id)}
                          onToggle={() => toggleHypedditSelection(track.id)}
                          rightSlot={
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#666666] dark:text-muted-foreground">
                                {formatDuration(track.duration)}
                              </span>
                              <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                Hypeddit
                              </span>
                            </div>
                          }
                        />
                      );
                    }

                    return (
                      <div
                        key={track.id}
                        className={`group flex items-center gap-4 rounded-xl bg-gray-50 p-3 transition-colors dark:bg-secondary/20 ${hypedditMode ? "opacity-40" : "hover:bg-gray-100 dark:hover:bg-secondary/40"}`}
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
                        {isOwner && isHypeddit && !hypedditMode && (
                          <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 shrink-0">
                            H
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={downloadingTrackId === track.id}
                          onClick={() => handleDownload(track)}
                          className={`rounded-lg p-2 text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${getDownloadTone(track)}`}
                          title={getDownloadLabel(track)}
                        >
                          {downloadingTrackId === track.id ? (
                            <LoadingSpinner className="h-5 w-5 text-white" />
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove tracks?"
        description={`Remove ${selectedTrackIds.size} track${selectedTrackIds.size !== 1 ? "s" : ""} from "${selectedSource?.title}"? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={executeRemove}
        onCancel={() => setShowRemoveConfirm(false)}
      >
        <BulkReviewDetails
          action="removing"
          warning="This updates the playlist on SoundCloud. Export the selection first if you need a record."
          exportFilename="downloads-remove-selection.csv"
          items={tracks
            .filter((track) => selectedTrackIds.has(track.id))
            .map((track) => ({
              id: track.id,
              label: track.title,
              meta: track.user?.username,
            }))}
        />
      </ConfirmDialog>
    </PageContainer>
  );
}
