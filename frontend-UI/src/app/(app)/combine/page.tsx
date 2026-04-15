"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, X, Combine, Check, Music, Trash2, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { EmptyState, LoadingSpinner, Skeleton } from "@/components/ui";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
  artwork_url: string;
  coverUrl?: string;
}

type MergeMode = "new" | "existing";

export default function CombinePlaylistsPage() {
  const [selectedPlaylists, setSelectedPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [mergeMode, setMergeMode] = useState<MergeMode>("new");
  const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [result, setResult] = useState<{
    playlists?: { title: string }[];
    playlist?: { title: string };
    overflowPlaylists?: { title: string }[];
    deletedPlaylistIds?: number[];
    deleteErrors?: { id: number; error: string }[];
    stats?: {
      totalTracks?: number;
      finalCount?: number;
      uniqueBeforeCap?: number;
      existingTrackCount?: number;
      addedCount?: number;
    };
    totalTracks?: number;
  } | null>(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      setLoadError(false);
      const response = await apiFetch("/api/playlists");
      if (response.ok) {
        const data = await response.json();
        setUserPlaylists(data.collection || []);
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

  const handlePlaylistToggle = (playlist: Playlist) => {
    const idNum = Number(playlist.id);
    setSelectedPlaylists((prev) =>
      prev.find((p) => Number(p.id) === idNum)
        ? prev.filter((p) => Number(p.id) !== idNum)
        : [...prev, { ...playlist, id: idNum }]
    );
    // Clear target if it gets selected as source
    if (targetPlaylist && Number(targetPlaylist.id) === idNum) {
      setTargetPlaylist(null);
    }
  };

  // Playlists available as merge target (exclude selected sources)
  const availableTargets = userPlaylists.filter(
    (p) => !selectedPlaylists.some((s) => Number(s.id) === Number(p.id))
  );

  const canMerge =
    selectedPlaylists.length >= 2 &&
    (mergeMode === "existing" ? targetPlaylist !== null : newPlaylistTitle.trim().length > 0);

  const handleMergeClick = () => {
    if (!canMerge) return;
    if (deleteAfterMerge && selectedPlaylists.length > 0) {
      setShowDeleteConfirm(true);
    } else {
      executeMerge();
    }
  };

  const executeMerge = async () => {
    setShowDeleteConfirm(false);
    setIsProcessing(true);
    try {
      const body: Record<string, unknown> = {
        sourcePlaylistIds: selectedPlaylists.map((p) => p.id),
      };
      if (mergeMode === "existing" && targetPlaylist) {
        body.targetPlaylistId = targetPlaylist.id;
        body.deleteAfterMerge = deleteAfterMerge;
      } else {
        body.title = newPlaylistTitle.trim();
      }

      const response = await apiFetch("/api/playlists/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setIsComplete(true);
      } else {
        const error = await response.json().catch(() => ({}));
        alert(
          typeof error?.error === "string"
            ? error.error
            : "Failed to merge playlists. Please try again."
        );
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

  // ── SUCCESS SCREEN ──────────────────────────────────────────────────────────
  if (isComplete) {
    const playlists =
      result?.playlists || (result?.playlist ? [result.playlist] : []);
    const overflowPlaylists = result?.overflowPlaylists || [];
    const numPlaylists = playlists.length + overflowPlaylists.length;
    const totalTracksCreated =
      result?.stats?.totalTracks ||
      result?.stats?.finalCount ||
      result?.totalTracks ||
      0;
    const addedCount = result?.stats?.addedCount;
    const deletedIds = result?.deletedPlaylistIds || [];
    const deleteErrors = result?.deleteErrors || [];

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#F2F2F2] dark:bg-background">
        <div className="max-w-2xl w-full">
          <div className="text-center rounded-2xl p-10 shadow-xl border-2 bg-white dark:bg-card border-gray-200 dark:border-border">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#333333] dark:text-foreground">
              {mergeMode === "existing" ? "Playlist Updated!" : numPlaylists > 1 ? `${numPlaylists} Playlists Created!` : "Playlist Created!"}
            </h1>
            <p className="text-lg mb-4 leading-relaxed text-[#666666] dark:text-muted-foreground">
              {mergeMode === "existing" ? (
                <>
                  Added {addedCount ?? totalTracksCreated} new tracks to &quot;{playlists[0]?.title || targetPlaylist?.title}&quot;.
                  {overflowPlaylists.length > 0 && ` ${overflowPlaylists.length} overflow playlist(s) created for tracks beyond the 500-track limit.`}
                </>
              ) : numPlaylists > 1 ? (
                <>Split into {numPlaylists} playlists (500 tracks each).</>
              ) : (
                <>
                  &quot;{playlists[0]?.title || newPlaylistTitle}&quot; has been created with {totalTracksCreated} tracks (duplicates removed).
                </>
              )}
            </p>

            {/* Deletion results */}
            {deletedIds.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-left">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  {deletedIds.length} source playlist{deletedIds.length > 1 ? "s" : ""} deleted
                </p>
              </div>
            )}
            {deleteErrors.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-left">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  {deleteErrors.length} playlist{deleteErrors.length > 1 ? "s" : ""} could not be deleted
                </p>
                <ul className="text-xs text-yellow-600 dark:text-yellow-500 space-y-0.5">
                  {deleteErrors.map((e) => (
                    <li key={e.id}>ID {e.id}: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}

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
                  setTargetPlaylist(null);
                  setDeleteAfterMerge(false);
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

  // ── DELETE CONFIRMATION DIALOG ──────────────────────────────────────────────
  if (showDeleteConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-[#F2F2F2] dark:bg-background">
        <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl p-8 shadow-xl border-2 border-gray-200 dark:border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">Confirm Deletion</h2>
          </div>
          <p className="text-[#666666] dark:text-muted-foreground mb-4">
            After merging, the following source playlists will be permanently deleted:
          </p>
          <ul className="mb-6 space-y-1">
            {selectedPlaylists.map((p) => (
              <li key={p.id} className="text-sm text-[#333333] dark:text-foreground flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                {p.title}
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#999999] dark:text-muted-foreground mb-6">
            This action cannot be undone. The merge will proceed even if some deletions fail.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 rounded-lg font-semibold border-2 border-gray-200 dark:border-border text-[#333333] dark:text-foreground hover:border-[#FF5500] transition"
            >
              Cancel
            </button>
            <button
              onClick={executeMerge}
              className="flex-1 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition"
            >
              Merge &amp; Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN PAGE ───────────────────────────────────────────────────────────────
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
            Select playlists to merge. Duplicates will be automatically removed.
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
                    <Skeleton key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/40" />
                  ))}
                </div>
              ) : loadError ? (
                <EmptyState
                  title="Couldn't load your playlists"
                  description="The backend may be unreachable. Retry to refresh the list."
                  action={
                    <button
                      type="button"
                      onClick={() => { setLoading(true); fetchPlaylists(); }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-md transition"
                    >
                      Retry
                    </button>
                  }
                />
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
                    const isTarget = targetPlaylist && Number(targetPlaylist.id) === Number(playlist.id);
                    return (
                      <button
                        key={playlist.id}
                        onClick={() => handlePlaylistToggle(playlist)}
                        disabled={isTarget === true}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                          isTarget
                            ? "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-secondary/20 border-2 border-transparent"
                            : isSelected
                            ? "bg-[#FF5500]/10 border-2 border-[#FF5500]"
                            : "bg-gray-50 dark:bg-secondary/20 border-2 border-transparent hover:border-gray-200 dark:hover:border-border"
                        }`}
                      >
                        <img
                          src={playlist.artwork_url || playlist.coverUrl || "/SC Toolkit Icon.png"}
                          alt={playlist.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-[#333333] dark:text-foreground">
                            {playlist.title}
                          </div>
                          <div className="text-sm text-[#666666] dark:text-muted-foreground">
                            {playlist.track_count} tracks
                            {isTarget && <span className="ml-2 text-[#FF5500]">(target)</span>}
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
            <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border sticky top-24 space-y-5">
              <h2 className="text-xl font-bold text-[#333333] dark:text-foreground">
                Merge Settings
              </h2>

              {/* Selected Playlists */}
              <div>
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
              <div className="p-4 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                <div className="text-sm text-[#666666] dark:text-muted-foreground">Total Tracks</div>
                <div className="text-2xl font-bold text-[#333333] dark:text-foreground">{totalTracks}</div>
                {totalTracks > 500 && (
                  <p className="text-xs text-[#FF5500] mt-1">
                    Will be split into multiple playlists (500 max each)
                  </p>
                )}
              </div>

              {/* Merge Mode Toggle */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                  Merge into
                </label>
                <div className="flex rounded-lg border-2 border-gray-200 dark:border-border overflow-hidden">
                  <button
                    onClick={() => setMergeMode("new")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      mergeMode === "new"
                        ? "bg-[#FF5500] text-white"
                        : "text-[#666666] dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/20"
                    }`}
                  >
                    New playlist
                  </button>
                  <button
                    onClick={() => setMergeMode("existing")}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      mergeMode === "existing"
                        ? "bg-[#FF5500] text-white"
                        : "text-[#666666] dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/20"
                    }`}
                  >
                    Existing playlist
                  </button>
                </div>
              </div>

              {/* New Playlist Title (only in "new" mode) */}
              {mergeMode === "new" && (
                <div>
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
              )}

              {/* Target Playlist Picker (only in "existing" mode) */}
              {mergeMode === "existing" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#666666] dark:text-muted-foreground">
                    Target Playlist
                  </label>
                  {availableTargets.length === 0 ? (
                    <p className="text-sm text-[#999999] dark:text-muted-foreground py-3 text-center border-2 border-dashed border-gray-200 dark:border-border rounded-lg">
                      No available targets (deselect a source first)
                    </p>
                  ) : (
                    <select
                      value={targetPlaylist?.id ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setTargetPlaylist(availableTargets.find((p) => Number(p.id) === id) || null);
                      }}
                      className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
                    >
                      <option value="">Select a playlist…</option>
                      {availableTargets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.track_count} tracks)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Delete after merge checkbox */}
              {mergeMode === "existing" && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={deleteAfterMerge}
                    onChange={(e) => setDeleteAfterMerge(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#FF5500]"
                  />
                  <span className="text-sm text-[#666666] dark:text-muted-foreground group-hover:text-[#333333] dark:group-hover:text-foreground transition">
                    Delete source playlists after merge
                  </span>
                </label>
              )}

              {/* Merge Button */}
              <button
                onClick={handleMergeClick}
                disabled={!canMerge || isProcessing}
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
