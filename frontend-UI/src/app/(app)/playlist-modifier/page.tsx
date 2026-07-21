"use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  Heart,
  Search,
} from "lucide-react";
import {
  Button,
  BulkReviewDetails,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  Input,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  invalidatePlaylistCaches,
  playlistDetailQueryOptions,
  usePlaylistDetailQuery,
  usePlaylistsQuery,
  useLikesQuery,
} from "@/lib/queries";

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
  genre?: string;
  downloadable?: boolean | string;
  download_url?: string;
  purchase_url?: string;
  purchase_title?: string;
}

type TrackFilter = "all" | "downloadable" | "buylink";

type TransferAction = "move" | "duplicate";

type BannerState = { tone: "success" | "warning" | "error"; text: string } | null;

export default function PlaylistModifierPage() {
  const queryClient = useQueryClient();
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
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

  // Liked tracks view state
  const [isLikedTracksView, setIsLikedTracksView] = useState(false);
  const [likedSearch, setLikedSearch] = useState("");
  const [likedGenreFilter, setLikedGenreFilter] = useState("All");
  const [likedDurationFilter, setLikedDurationFilter] = useState("All");
  const [alsoUnlike, setAlsoUnlike] = useState(false);

  const filteredTracks = tracks.filter((t) => {
    if (trackFilter === "downloadable") return Boolean(t.downloadable) || t.downloadable === "true";
    if (trackFilter === "buylink") return !!t.purchase_url;
    return true;
  });

  const downloadCount = tracks.filter((t) => Boolean(t.downloadable) || t.downloadable === "true").length;
  const buyLinkCount = tracks.filter((t) => !!t.purchase_url).length;

  const playlistsQuery = usePlaylistsQuery();
  const playlists = useMemo(
    () => (playlistsQuery.data?.collection || []) as unknown as Playlist[],
    [playlistsQuery.data?.collection],
  );
  const selectedPlaylistQuery = usePlaylistDetailQuery(selectedPlaylist?.id ?? 0, {
    enabled: selectedPlaylist != null,
  });
  const likesQuery = useLikesQuery({ enabled: isLikedTracksView });
  const loading = playlistsQuery.isLoading;
  const loadingTracks = selectedPlaylist != null && selectedPlaylistQuery.isLoading;
  const loadingLikes = isLikedTracksView && likesQuery.isLoading;

  // Parse liked tracks into Track[] shape
  const likedTracks: Track[] = useMemo(() => {
    if (!isLikedTracksView || !likesQuery.data?.collection) return [];
    return (likesQuery.data.collection as unknown as Array<{ track?: Track } & Track>).map(
      (item) => {
        const t = item.track || item;
        return {
          id: t.id,
          title: t.title,
          user: t.user,
          artwork_url: t.artwork_url,
          duration: t.duration,
          genre: (t as Track & { genre?: string }).genre,
          downloadable: t.downloadable,
          download_url: t.download_url,
          purchase_url: t.purchase_url,
          purchase_title: t.purchase_title,
        };
      },
    );
  }, [isLikedTracksView, likesQuery.data?.collection]);

  // Filter liked tracks
  const filteredLikedTracks = useMemo(() => {
    return likedTracks
      .filter(
        (t) =>
          !likedSearch ||
          t.title.toLowerCase().includes(likedSearch.toLowerCase()) ||
          t.user?.username?.toLowerCase().includes(likedSearch.toLowerCase())
      )
      .filter((t) => likedGenreFilter === "All" || (t as Track & { genre?: string }).genre === likedGenreFilter)
      .filter((t) => {
        if (likedDurationFilter === "All") return true;
        const mins = t.duration / 60000;
        if (likedDurationFilter === "< 3 mins") return mins < 3;
        if (likedDurationFilter === "3-5 mins") return mins >= 3 && mins <= 5;
        if (likedDurationFilter === "5-10 mins") return mins > 5 && mins <= 10;
        if (likedDurationFilter === "> 10 mins") return mins > 10;
        return true;
      });
  }, [likedTracks, likedSearch, likedGenreFilter, likedDurationFilter]);

  const likedGenres = useMemo(
    () => Array.from(new Set(likedTracks.map((t) => (t as Track & { genre?: string }).genre).filter(Boolean))) as string[],
    [likedTracks],
  );

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

  useEffect(() => {
    if (playlistsQuery.isError) {
      setLoadError(true);
    }
  }, [playlistsQuery.isError]);

  useEffect(() => {
    setSelectedPlaylist((prev) => {
      if (!prev) return prev;
      const next = playlists.find((playlist) => playlist.id === prev.id);
      return next ? { ...prev, ...next } : prev;
    });
  }, [playlists]);

  useEffect(() => {
    if (selectedPlaylistQuery.isError) {
      setTracksError(true);
      return;
    }

    if (selectedPlaylistQuery.data) {
      setTracks((selectedPlaylistQuery.data.tracks || []) as unknown as Track[]);
      setTracksError(false);
    }
  }, [selectedPlaylistQuery.data, selectedPlaylistQuery.isError]);

  const selectPlaylist = (playlist: Playlist) => {
    setIsLikedTracksView(false);
    setSelectedPlaylist(playlist);
  };

  const selectLikedTracks = () => {
    setSelectedPlaylist(null);
    setTracks([]);
    setIsLikedTracksView(true);
    setLikedSearch("");
    setLikedGenreFilter("All");
    setLikedDurationFilter("All");
  };

  const goBackToList = () => {
    setSelectedPlaylist(null);
    setTracks([]);
    setIsLikedTracksView(false);
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
    if (!selectedPlaylist && !isLikedTracksView) return;
    setOpenMenuTrackId(null);
    setTransfer({ action, track });
    setAlsoUnlike(false);
    if (isLikedTracksView) {
      // From liked tracks: all playlists are valid targets
      setTransferTargetId(playlists[0]?.id ?? "");
    } else {
      const others = playlists.filter((p) => p.id !== selectedPlaylist!.id);
      const defaultTarget =
        action === "move"
          ? others[0]?.id
          : playlists.find((p) => p.id !== selectedPlaylist!.id)?.id ?? playlists[0]?.id;
      setTransferTargetId(defaultTarget ?? "");
    }
  };

  const submitTransfer = async () => {
    if ((!selectedPlaylist && !isLikedTracksView) || !transfer || transferTargetId === "") return;
    const targetId = Number(transferTargetId);
    if (!isLikedTracksView && transfer.action === "move" && targetId === selectedPlaylist!.id) return;

    setTransferLoading(true);
    try {
      const transferBody: Record<string, unknown> = {
        action: isLikedTracksView ? "duplicate" : transfer.action,
        trackId: transfer.track.id,
        targetPlaylistId: targetId,
      };
      if (!isLikedTracksView && selectedPlaylist) {
        transferBody.sourcePlaylistId = selectedPlaylist.id;
      }
      const res = await apiFetch("/api/playlists/transfer-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transferBody),
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
        if (selectedPlaylist) {
          await invalidatePlaylistCaches(queryClient, selectedPlaylist.id);
          await Promise.all([selectedPlaylistQuery.refetch(), playlistsQuery.refetch()]);
        } else {
          await playlistsQuery.refetch();
        }
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

      // Auto-unlike from liked tracks if checkbox was checked
      if (isLikedTracksView && alsoUnlike) {
        try {
          await apiFetch("/api/likes/tracks/bulk-unlike", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackIds: [transfer.track.id] }),
          });
        } catch {
          // Unlike failed silently — track is already in target playlist
        }
      }

      setTransfer(null);
      if (selectedPlaylist) {
        await invalidatePlaylistCaches(queryClient, selectedPlaylist.id);
        await Promise.all([selectedPlaylistQuery.refetch(), playlistsQuery.refetch()]);
      } else {
        await Promise.all([likesQuery.refetch(), playlistsQuery.refetch()]);
      }
    } catch {
      setBanner({ tone: "error", text: "Network error — try again." });
    } finally {
      setTransferLoading(false);
    }
  };

  const transferTargetOptions = isLikedTracksView
    ? playlists
    : transfer?.action === "move"
      ? playlists.filter((p) => p.id !== selectedPlaylist?.id)
      : playlists;

  const transferSubmitDisabled =
    transferLoading ||
    transferTargetId === "" ||
    (!isLikedTracksView && transfer?.action === "move" && Number(transferTargetId) === selectedPlaylist?.id);

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
        await invalidatePlaylistCaches(queryClient, selectedPlaylist.id);
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

        {!selectedPlaylist && !isLikedTracksView ? (
          /* Playlist Selection */
          <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
            <h2 className="text-xl font-bold mb-4 text-foreground">
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
                title="Couldn't load your playlists"
                description="The backend may be unreachable. Retry to refresh the list."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      playlistsQuery.refetch();
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
                {/* Liked Tracks virtual entry */}
                <button
                  onClick={selectLikedTracks}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-2 border-transparent hover:border-primary transition-all text-left col-span-full"
                >
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex items-center justify-center flex-shrink-0">
                    <Heart className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Liked Tracks</div>
                    <div className="text-sm text-muted-foreground">
                      Browse and add liked tracks to your playlists
                    </div>
                  </div>
                </button>
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => selectPlaylist(playlist)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-primary transition-all text-left"
                  >
                    <img
                      src={playlist.coverUrl || playlist.artwork_url || "/SC Toolkit Icon.png"}
                      alt={playlist.title}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div>
                      <div className="font-semibold text-foreground">
                        {playlist.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {playlist.track_count} tracks
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : isLikedTracksView ? (
          /* Liked Tracks View */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={goBackToList}
                  className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to playlists
                </button>
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-[#FF5500]" />
                  <h2 className="text-2xl font-bold text-foreground">
                    Liked Tracks
                  </h2>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border">
              {/* Search and filter controls */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={likedSearch}
                    onChange={(e) => setLikedSearch(e.target.value)}
                    placeholder="Search liked tracks..."
                    className="pl-9 h-10 bg-secondary/20 border-border"
                  />
                </div>
                {likedGenres.length > 0 && (
                  <select
                    value={likedGenreFilter}
                    onChange={(e) => setLikedGenreFilter(e.target.value)}
                    className="h-10 px-3 border-2 border-border rounded-lg text-sm text-foreground bg-secondary/20 focus:border-primary focus:outline-none max-w-[150px] truncate"
                  >
                    <option value="All">All Genres</option>
                    {likedGenres.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                )}
                <select
                  value={likedDurationFilter}
                  onChange={(e) => setLikedDurationFilter(e.target.value)}
                  className="h-10 px-3 border-2 border-border rounded-lg text-sm text-foreground bg-secondary/20 focus:border-primary focus:outline-none"
                >
                  <option value="All">All Durations</option>
                  <option value="< 3 mins">&lt; 3 mins</option>
                  <option value="3-5 mins">3-5 mins</option>
                  <option value="5-10 mins">5-10 mins</option>
                  <option value="> 10 mins">&gt; 10 mins</option>
                </select>
              </div>

              <div className="text-sm text-muted-foreground mb-2">
                {filteredLikedTracks.length} of {likedTracks.length} tracks
              </div>

              {loadingLikes ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/40"
                    />
                  ))}
                </div>
              ) : likesQuery.isError ? (
                <EmptyState
                  title="Couldn't load your liked tracks"
                  description="The backend may be unreachable. Retry to refresh."
                  action={
                    <button
                      type="button"
                      onClick={() => likesQuery.refetch()}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-md transition"
                    >
                      Retry
                    </button>
                  }
                />
              ) : likedTracks.length === 0 ? (
                <EmptyState
                  icon={<Heart className="w-12 h-12" />}
                  title="No liked tracks"
                  description="You haven't liked any tracks yet."
                />
              ) : filteredLikedTracks.length === 0 ? (
                <EmptyState
                  icon={<Music className="w-12 h-12" />}
                  title="No tracks match your filters"
                  description="Try adjusting your search or filters."
                />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {filteredLikedTracks.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 dark:bg-secondary/20 group"
                    >
                      <img
                        src={track.artwork_url || "/SC Toolkit Icon.png"}
                        alt={track.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate flex items-center gap-2">
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
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
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
                            className="p-2 hover:bg-gray-200 dark:hover:bg-secondary/40 rounded text-foreground"
                            title="Add to playlist"
                            aria-expanded={openMenuTrackId === track.id}
                            aria-haspopup="true"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMenuTrackId === track.id && (
                            <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border-2 border-gray-200 dark:border-border bg-white dark:bg-card shadow-lg py-1 text-left">
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-secondary/40 flex items-center gap-2 text-foreground"
                                onClick={() => openTransferModal("move", track)}
                              >
                                <ArrowRightLeft className="w-4 h-4 shrink-0" />
                                Add to playlist…
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-secondary/40 flex items-center gap-2 text-foreground"
                                onClick={() => openTransferModal("duplicate", track)}
                              >
                                <Copy className="w-4 h-4 shrink-0" />
                                Duplicate to playlist…
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedPlaylist ? (
          /* Track Editor */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={goBackToList}
                  className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-primary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to playlists
                </button>
                <h2 className="text-2xl font-bold text-foreground">
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
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-secondary/20 text-muted-foreground hover:bg-gray-200 dark:hover:bg-secondary/40"
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
                      onClick={() => selectedPlaylistQuery.refetch()}
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
                      <span className="w-8 text-center text-sm text-muted-foreground/70">
                        {globalIndex + 1}
                      </span>
                      <img
                        src={track.artwork_url || "/SC Toolkit Icon.png"}
                        alt={track.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground truncate flex items-center gap-2">
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
                        <div className="text-sm text-muted-foreground truncate">
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
                            className="p-2 hover:bg-gray-200 dark:hover:bg-secondary/40 rounded text-foreground"
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
                                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-secondary/40 flex items-center gap-2 text-foreground"
                                onClick={() => openTransferModal("move", track)}
                              >
                                <ArrowRightLeft className="w-4 h-4 shrink-0" />
                                Move to playlist…
                              </button>
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-secondary/40 flex items-center gap-2 text-foreground"
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
        ) : null}
      {transfer && (selectedPlaylist || isLikedTracksView) && (
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
              className="text-lg font-bold text-foreground mb-2"
            >
              {transfer.action === "move"
                ? "Move track to playlist"
                : "Duplicate track to playlist"}
            </h3>
            <p
              className="text-sm text-muted-foreground mb-4 truncate"
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
                <span className="text-sm font-medium text-foreground mb-1 block">
                  Target playlist
                </span>
                <select
                  className="w-full rounded-lg border-2 border-gray-200 dark:border-border bg-white dark:bg-background px-3 py-2 text-foreground"
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
            <p className="text-xs text-muted-foreground mb-4">
              {isLikedTracksView
                ? "The track will be added to the selected playlist."
                : transfer.action === "move"
                  ? "The track is added to the target playlist first, then removed from this one."
                  : "The track is copied to the end of the target playlist. Playlists you don't own aren't listed."}
            </p>
            {isLikedTracksView && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoUnlike}
                  onChange={(e) => setAlsoUnlike(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-border text-primary focus:ring-primary accent-primary"
                />
                <span className="text-sm text-foreground">
                  Also unlike this track
                </span>
              </label>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-border text-foreground hover:bg-gray-50 dark:hover:bg-secondary/40 disabled:opacity-50"
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
