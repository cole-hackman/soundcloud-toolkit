"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Shuffle,
  Save,
  ArrowUpDown,
  Trash2,
  Music,
  Download,
  ExternalLink,
  MoreVertical,
  Copy,
  ArrowRightLeft,
  X,
} from "lucide-react";
import {
  Button,
  BulkReviewDetails,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";

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

type TransferAction = "move" | "duplicate";

type BannerState = { tone: "success" | "warning" | "error"; text: string } | null;

export default function PlaylistModifierPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("all");
  const [loadError, setLoadError] = useState(false);
  const [tracksError, setTracksError] = useState(false);
  const [openMenuTrackId, setOpenMenuTrackId] = useState<number | null>(null);
  const [transfer, setTransfer] = useState<{
    action: TransferAction;
    track: Track;
  } | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<number | "">("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [trackToRemove, setTrackToRemove] = useState<number | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<number | null>(null);

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

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 9000);
    return () => clearTimeout(t);
  }, [banner]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-track-menu]")) return;
      setOpenMenuTrackId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!transfer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTransfer(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [transfer]);

  const fetchPlaylists = async () => {
    try {
      setLoadError(false);
      const response = await apiFetch("/api/playlists");
      if (response.ok) {
        const data = await response.json();
        const coll: Playlist[] = data.collection || [];
        setPlaylists(coll);
        setSelectedPlaylist((prev) => {
          if (!prev) return prev;
          const next = coll.find((p) => p.id === prev.id);
          return next ? { ...prev, ...next } : prev;
        });
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracks = async (playlistId: number) => {
    setLoadingTracks(true);
    setTracksError(false);
    try {
      const response = await apiFetch(`/api/playlists/${playlistId}`);
      if (response.ok) {
        const data = await response.json();
        setTracks(data.tracks || []);
      } else {
        setTracksError(true);
      }
    } catch (error) {
      console.error("Failed to fetch tracks:", error);
      setTracksError(true);
    } finally {
      setLoadingTracks(false);
    }
  };

  const selectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    fetchTracks(playlist.id);
  };

  const removeTrack = (trackId: number) => {
    setTrackToRemove(trackId);
  };

  const executeRemoveTrack = () => {
    if (trackToRemove === null) return;
    setTracks((prev) => prev.filter((t) => t.id !== trackToRemove));
    setTrackToRemove(null);
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

  const openTransferModal = (action: TransferAction, track: Track) => {
    if (!selectedPlaylist) return;
    setOpenMenuTrackId(null);
    setTransfer({ action, track });
    const others = playlists.filter((p) => p.id !== selectedPlaylist.id);
    const defaultTarget =
      action === "move"
        ? others[0]?.id
        : playlists.find((p) => p.id !== selectedPlaylist.id)?.id ?? playlists[0]?.id;
    setTransferTargetId(defaultTarget ?? "");
  };

  const submitTransfer = async () => {
    if (!selectedPlaylist || !transfer || transferTargetId === "") return;
    const targetId = Number(transferTargetId);
    if (transfer.action === "move" && targetId === selectedPlaylist.id) return;

    setTransferLoading(true);
    try {
      const res = await apiFetch("/api/playlists/transfer-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: transfer.action,
          trackId: transfer.track.id,
          sourcePlaylistId: selectedPlaylist.id,
          targetPlaylistId: targetId,
        }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        /* ignore */
      }

      if (!res.ok) {
        setBanner({
          tone: "error",
          text: typeof data.error === "string" ? data.error : "Transfer failed",
        });
        return;
      }

      if (data.partial) {
        setBanner({
          tone: "warning",
          text:
            typeof data.message === "string"
              ? data.message
              : typeof data.error === "string"
                ? data.error
                : "The track may have been added to the target playlist, but the source could not be updated.",
        });
        setTransfer(null);
        await fetchTracks(selectedPlaylist.id);
        await fetchPlaylists();
        return;
      }

      if (data.ok === false) {
        setBanner({
          tone: "error",
          text: typeof data.error === "string" ? data.error : "Transfer failed",
        });
        return;
      }

      const targetTitle =
        (typeof data.targetTitle === "string" && data.targetTitle) ||
        playlists.find((p) => p.id === targetId)?.title ||
        "playlist";

      if (data.noop && typeof data.message === "string") {
        setBanner({ tone: "success", text: data.message });
      } else if (transfer.action === "move") {
        setBanner({ tone: "success", text: `Track moved to “${targetTitle}”.` });
      } else {
        setBanner({ tone: "success", text: `Track duplicated to “${targetTitle}”.` });
      }

      setTransfer(null);
      await fetchTracks(selectedPlaylist.id);
      await fetchPlaylists();
    } catch {
      setBanner({ tone: "error", text: "Network error — try again." });
    } finally {
      setTransferLoading(false);
    }
  };

  const transferTargetOptions =
    transfer?.action === "move"
      ? playlists.filter((p) => p.id !== selectedPlaylist?.id)
      : playlists;

  const transferSubmitDisabled =
    transferLoading ||
    transferTargetId === "" ||
    (transfer?.action === "move" && Number(transferTargetId) === selectedPlaylist?.id);

  const savePlaylist = async () => {
    if (!selectedPlaylist) return;
    setShowSaveConfirm(true);
  };

  const executeSavePlaylist = async () => {
    if (!selectedPlaylist) return;
    setShowSaveConfirm(false);
    setSaving(true);
    try {
      const response = await apiFetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: tracks.map((t) => t.id) }),
      });
      if (response.ok) {
        setBanner({ tone: "success", text: "Playlist saved successfully." });
      } else {
        setBanner({ tone: "error", text: "Failed to save playlist." });
      }
    } catch (error) {
      console.error("Error saving playlist:", error);
      setBanner({ tone: "error", text: "An error occurred while saving the playlist." });
    } finally {
      setSaving(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDownload = async (track: Track) => {
    if (!track.download_url) return;
    setDownloadingTrackId(track.id);
    try {
      const response = await apiFetch(
        `/api/proxy-download?format=json&url=${encodeURIComponent(track.download_url)}`
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        setBanner({
          tone: "error",
          text: data?.error || "SoundCloud did not provide a valid download link for this track.",
        });
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      setBanner({ tone: "error", text: "Could not start the download. Try again." });
    } finally {
      setDownloadingTrackId(null);
    }
  };

  return (
    <PageContainer maxWidth="wide">
        <PageHeader
          title="Playlist Modifier"
          description="Reorder, remove, move, or duplicate tracks between your playlists."
        />

        {banner && (
          <InlineAlert
            variant={banner.tone}
            className="mb-6"
            onDismiss={() => setBanner(null)}
          >
            {banner.text}
          </InlineAlert>
        )}

        {!selectedPlaylist ? (
          /* Playlist Selection */
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <h2 className="text-xl font-bold mb-4 text-[#333333] dark:text-foreground">
              Select a Playlist to Modify
            </h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/40"
                  />
                ))}
              </div>
            ) : loadError ? (
              <EmptyState
                title="Couldn’t load your playlists"
                description="The backend may be unreachable. Retry to refresh the list."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      fetchPlaylists();
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-md transition"
                  >
                    Retry
                  </button>
                }
              />
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
                  className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to playlists
                </button>
                <h2 className="text-2xl font-bold text-[#333333] dark:text-foreground">
                  {selectedPlaylist.title}
                </h2>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={shuffleTracks}
                  variant="outline"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle
                </Button>
                <Button
                  onClick={savePlaylist}
                  disabled={saving}
                >
                  {saving ? (
                    <LoadingSpinner size="sm" className="w-4 h-4 border-white" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
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
                    <Skeleton
                      key={i}
                      className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/40"
                    />
                  ))}
                </div>
              ) : tracksError ? (
                <EmptyState
                  title="Couldn’t load tracks for this playlist"
                  description="The playlist data could not be fetched. Retry to try again."
                  action={
                    <button
                      type="button"
                      onClick={() => selectedPlaylist && fetchTracks(selectedPlaylist.id)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-md transition"
                    >
                      Retry
                    </button>
                  }
                />
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(track);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              disabled={downloadingTrackId === track.id}
                              title="Download track" 
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium flex-shrink-0 hover:bg-green-200 dark:hover:bg-green-900/50 transition disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Download className="w-3 h-3" /> DL
                            </button>
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
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100 transition">
                        <div className="relative" data-track-menu>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuTrackId(
                                openMenuTrackId === track.id ? null : track.id
                              )
                            }
                            className="p-2 hover:bg-gray-200 dark:hover:bg-secondary/40 rounded text-[#333333] dark:text-foreground"
                            title="More actions"
                            aria-expanded={openMenuTrackId === track.id}
                            aria-haspopup="true"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuTrackId === track.id && (
                            <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border-2 border-gray-200 dark:border-border bg-white dark:bg-card shadow-lg py-1 text-left">
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-secondary/40 flex items-center gap-2 text-[#333333] dark:text-foreground"
                                onClick={() => openTransferModal("move", track)}
                              >
                                <ArrowRightLeft className="w-4 h-4 shrink-0" />
                                Move to playlist…
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-secondary/40 flex items-center gap-2 text-[#333333] dark:text-foreground"
                                onClick={() => openTransferModal("duplicate", track)}
                              >
                                <Copy className="w-4 h-4 shrink-0" />
                                Duplicate to playlist…
                              </button>
                            </div>
                          )}
                        </div>
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

      {transfer && selectedPlaylist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !transferLoading) setTransfer(null);
          }}
        >
          <div
            className="bg-white dark:bg-card rounded-2xl border-2 border-gray-200 dark:border-border max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="transfer-dialog-title"
              className="text-lg font-bold text-[#333333] dark:text-foreground mb-2"
            >
              {transfer.action === "move"
                ? "Move track to playlist"
                : "Duplicate track to playlist"}
            </h3>
            <p
              className="text-sm text-[#666666] dark:text-muted-foreground mb-4 truncate"
              title={transfer.track.title}
            >
              {transfer.track.title}
            </p>
            {transferTargetOptions.length === 0 ? (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                No target playlist available. Create another playlist on SoundCloud first.
              </p>
            ) : (
              <label className="block mb-4">
                <span className="text-sm font-medium text-[#333333] dark:text-foreground mb-1 block">
                  Target playlist
                </span>
                <select
                  className="w-full rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-background px-3 py-2 text-[#333333] dark:text-foreground"
                  value={transferTargetId === "" ? "" : String(transferTargetId)}
                  onChange={(e) =>
                    setTransferTargetId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  disabled={transferLoading}
                >
                  {transferTargetOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.track_count} tracks)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="text-xs text-[#666666] dark:text-muted-foreground mb-4">
              {transfer.action === "move"
                ? "The track is added to the target playlist first, then removed from this one."
                : "The track is copied to the end of the target playlist. Playlists you don’t own aren’t listed."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-border text-[#333333] dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary/40 disabled:opacity-50"
                onClick={() => !transferLoading && setTransfer(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transferSubmitDisabled || transferTargetOptions.length === 0}
                onClick={() => void submitTransfer()}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white font-semibold hover:shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {transferLoading ? (
                  <LoadingSpinner size="sm" className="w-4 h-4 border-white" />
                ) : null}
                {transfer.action === "move" ? "Move" : "Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={trackToRemove !== null}
        title="Remove track?"
        description="Remove this track from the playlist on save? You can still cancel by not saving changes."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={executeRemoveTrack}
        onCancel={() => setTrackToRemove(null)}
      >
        <BulkReviewDetails
          action="removing"
          warning="This removes the track locally first. The playlist is not changed on SoundCloud until you save."
          items={tracks
            .filter((track) => track.id === trackToRemove)
            .map((track) => ({
              id: track.id,
              label: track.title,
              meta: track.user?.username,
            }))}
        />
      </ConfirmDialog>
      <ConfirmDialog
        open={showSaveConfirm}
        title="Save playlist changes?"
        description="Update this playlist on SoundCloud with the current order and removed tracks."
        confirmLabel="Save Changes"
        onConfirm={executeSavePlaylist}
        onCancel={() => setShowSaveConfirm(false)}
      >
        <BulkReviewDetails
          action="saving"
          warning="This writes the visible playlist order to SoundCloud. Export the current track list first if you want a record."
          exportFilename="playlist-save-review.csv"
          items={tracks.map((track, index) => ({
            id: track.id,
            label: `${index + 1}. ${track.title}`,
            meta: track.user?.username,
          }))}
        />
      </ConfirmDialog>
    </PageContainer>
  );
}
