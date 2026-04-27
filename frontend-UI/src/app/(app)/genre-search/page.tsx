"use client";

import { useState } from "react";
import { Search, Plus, Music, ChevronDown, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Button,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageHeader,
  SelectionBanner,
  TrackRow,
} from "@/components/ui";

const COMMON_GENRES = [
  "house", "techno", "ambient", "hip-hop", "drum-and-bass",
  "dubstep", "trance", "jazz", "classical", "electronic",
  "indie", "pop", "r-b-soul", "metal", "folk",
];

interface Track {
  id: number;
  title: string;
  user?: { username: string };
  artwork_url?: string;
  duration?: number;
  genre?: string;
  permalink_url?: string;
}

interface Playlist {
  id: number;
  title: string;
  track_count: number;
}

type AddMode = "new" | "existing";

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function GenreSearchPage() {
  // Search form state
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Results state
  const [results, setResults] = useState<Track[]>([]);
  const [nextHref, setNextHref] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Selection state
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());

  // Add-to-playlist state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("new");
  const [playlistName, setPlaylistName] = useState("");
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>([]);
  const [targetPlaylist, setTargetPlaylist] = useState<Playlist | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState("");
  const [addError, setAddError] = useState("");

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (genre.trim()) params.set("genres", genre.trim());
    if (tags.trim()) params.set("tags", tags.trim());
    if (bpmMin.trim()) params.set("bpm_from", bpmMin.trim());
    if (bpmMax.trim()) params.set("bpm_to", bpmMax.trim());
    params.set("limit", "50");
    return params;
  };

  const handleSearch = async () => {
    if (!genre.trim() && !tags.trim()) {
      setSearchError("Enter at least a genre or tag to search.");
      return;
    }
    setSearchError("");
    setSearching(true);
    setHasSearched(true);
    setResults([]);
    setNextHref(null);
    setSelectedTracks(new Set());
    try {
      const params = buildSearchParams();
      const res = await apiFetch(`/api/tracks/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.collection || []);
        setNextHref(data.next_href || null);
      } else {
        const err = await res.json().catch(() => ({}));
        setSearchError(typeof err?.error === "string" ? err.error : "Search failed. Try different filters.");
      }
    } catch {
      setSearchError("An error occurred. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextHref) return;
    setLoadingMore(true);
    try {
      // next_href is a full SoundCloud URL — proxy through our search endpoint with offset
      const url = new URL(nextHref);
      const cursor = url.searchParams.get("cursor") || url.searchParams.get("offset");
      const params = buildSearchParams();
      if (cursor) params.set("offset", cursor);
      const res = await apiFetch(`/api/tracks/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults((prev) => [...prev, ...(data.collection || [])]);
        setNextHref(data.next_href || null);
      } else {
        setSearchError("Couldn’t load more tracks. Please try again.");
      }
    } catch {
      setSearchError("Couldn’t load more tracks. Please try again.");
    } finally {
      setLoadingMore(false);
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

  const fetchUserPlaylists = async () => {
    if (userPlaylists.length > 0) return;
    setLoadingPlaylists(true);
    try {
      const res = await apiFetch("/api/playlists");
      if (res.ok) {
        const data = await res.json();
        setUserPlaylists(data.collection || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handleOpenAddPanel = () => {
    setShowAddPanel(true);
    setAddSuccess("");
    setAddError("");
    if (addMode === "existing") fetchUserPlaylists();
  };

  const handleAddToPlaylist = async () => {
    if (selectedTracks.size === 0) return;
    const canAdd = addMode === "existing" ? targetPlaylist !== null : playlistName.trim().length > 0;
    if (!canAdd) return;

    setAdding(true);
    setAddError("");
    try {
      const body: Record<string, unknown> = {
        trackIds: Array.from(selectedTracks),
      };
      if (addMode === "existing" && targetPlaylist) {
        body.targetPlaylistId = targetPlaylist.id;
      } else {
        body.title = playlistName.trim();
      }

      const res = await apiFetch("/api/playlists/from-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const count = data.addedCount ?? data.totalTracks ?? selectedTracks.size;
        const name = addMode === "existing" ? targetPlaylist?.title : (data.playlist?.title || playlistName);
        setAddSuccess(`${count} track${count !== 1 ? "s" : ""} added to "${name}".`);
        setSelectedTracks(new Set());
        setPlaylistName("");
      } else {
        setAddError(typeof data?.error === "string" ? data.error : "Failed to add tracks.");
      }
    } catch {
      setAddError("An error occurred. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className={`container mx-auto max-w-5xl px-6 py-6 ${selectedTracks.size > 0 ? "pb-28" : ""}`}>
        <PageHeader
          title="Genre Search"
          description="Discover tracks by genre or tag and add them to your playlists."
        />

        {/* Search Form */}
        <div className="bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border mb-8">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* Genre input with suggestions */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#666666] dark:text-muted-foreground">
                Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. house, techno, ambient…"
                list="genre-suggestions"
                className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
              />
              <datalist id="genre-suggestions">
                {COMMON_GENRES.map((g) => <option key={g} value={g} />)}
              </datalist>
              {/* Quick genre chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {COMMON_GENRES.slice(0, 8).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                      genre === g
                        ? "bg-[#FF5500] text-white"
                        : "bg-gray-100 dark:bg-secondary/40 text-[#666666] dark:text-muted-foreground hover:bg-[#FF5500]/10 hover:text-[#FF5500]"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags input */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#666666] dark:text-muted-foreground">
                Tags <span className="font-normal text-[#999999]">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="e.g. deep, melodic, chill…"
                className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
              />
            </div>
          </div>

          {/* Advanced filters toggle */}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-[#666666] dark:text-muted-foreground hover:text-[#FF5500] transition mb-3"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced filters
          </button>

          {showAdvanced && (
            <div className="grid sm:grid-cols-2 gap-4 mb-4 pt-2 border-t border-gray-100 dark:border-border">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[#666666] dark:text-muted-foreground">
                  BPM range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={bpmMin}
                    onChange={(e) => setBpmMin(e.target.value)}
                    placeholder="Min"
                    min={1}
                    max={300}
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
                  />
                  <span className="text-[#999999]">–</span>
                  <input
                    type="number"
                    value={bpmMax}
                    onChange={(e) => setBpmMax(e.target.value)}
                    placeholder="Max"
                    min={1}
                    max={300}
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {searchError && (
            <InlineAlert variant="error" className="mb-3" onDismiss={() => setSearchError("")}>
              {searchError}
            </InlineAlert>
          )}

          <Button
            onClick={handleSearch}
            disabled={searching}
            className="h-10 px-4"
          >
            {searching ? (
              <>
                <LoadingSpinner size="sm" className="border-white" />
                Searching…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Search
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {hasSearched && (
          <>
            {/* Add success banner */}
            {addSuccess && (
              <InlineAlert variant="success" className="mb-4" onDismiss={() => setAddSuccess("")}>
                {addSuccess}
              </InlineAlert>
            )}

            {results.length === 0 && !searching ? (
              <EmptyState
                icon={<Music className="w-12 h-12" />}
                title="No tracks found"
                description="Try a different genre, tag, or adjust your filters."
              />
            ) : (
              <>
                <div className="space-y-2">
                  {results.map((track) => {
                    const isSelected = selectedTracks.has(track.id);
                    return (
                      <TrackRow
                        key={track.id}
                        track={{
                          ...track,
                          subtitle: [track.user?.username, track.genre].filter(Boolean).join(" • "),
                        }}
                        isSelected={isSelected}
                        onToggle={() => toggleTrack(track.id)}
                        rightSlot={
                          track.duration ? (
                            <span className="text-xs text-[#666666] dark:text-muted-foreground">
                              {formatDuration(track.duration)}
                            </span>
                          ) : null
                        }
                        className={!isSelected ? "bg-white dark:bg-card" : undefined}
                      />
                    );
                  })}
                </div>

                {nextHref && (
                  <div className="mt-6 text-center">
                    <Button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      variant="outline"
                      className="mx-auto h-10 px-4"
                    >
                      {loadingMore ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Loading…
                        </>
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Add to Playlist Panel (modal-style overlay) */}
        {showAddPanel && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
            <div className="w-full max-w-md bg-white dark:bg-card rounded-2xl p-6 border-2 border-gray-200 dark:border-border shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#333333] dark:text-foreground">
                  Add {selectedTracks.size} track{selectedTracks.size !== 1 ? "s" : ""} to playlist
                </h3>
                <button
                  onClick={() => setShowAddPanel(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-surface-hover hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {addError && (
                <InlineAlert variant="error" onDismiss={() => setAddError("")}>
                  {addError}
                </InlineAlert>
              )}

              {/* Mode toggle */}
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
                  onClick={() => { setAddMode("existing"); fetchUserPlaylists(); }}
                  className={`flex-1 py-2 text-sm font-medium transition ${
                    addMode === "existing"
                      ? "bg-[#FF5500] text-white"
                      : "text-[#666666] dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/20"
                  }`}
                >
                  Existing playlist
                </button>
              </div>

              {addMode === "new" ? (
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="Playlist name…"
                  className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
                />
              ) : loadingPlaylists ? (
                <div className="flex items-center gap-2 py-2 text-sm text-[#999999]">
                  <LoadingSpinner size="sm" /> Loading playlists…
                </div>
              ) : (
                <select
                  value={targetPlaylist?.id ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setTargetPlaylist(userPlaylists.find((p) => Number(p.id) === id) || null);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 dark:border-border focus:border-[#FF5500] focus:outline-none transition dark:bg-secondary/20 dark:text-foreground text-sm"
                >
                  <option value="">Select a playlist…</option>
                  {userPlaylists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.track_count} tracks)
                    </option>
                  ))}
                </select>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddPanel(false)}
                  className="flex-1 py-2.5 rounded-lg font-semibold border-2 border-gray-200 dark:border-border text-[#333333] dark:text-foreground hover:border-[#FF5500] transition text-sm"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleAddToPlaylist}
                  disabled={adding || (addMode === "new" ? !playlistName.trim() : !targetPlaylist)}
                  className="flex-1 h-10 px-4"
                >
                  {adding ? <><LoadingSpinner size="sm" className="border-white" /> Adding…</> : "Add tracks"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <SelectionBanner
        count={selectedTracks.size}
        entityName="track"
        actionLabel="Add to Playlist"
        onAction={handleOpenAddPanel}
        actionIcon={<Plus className="h-4 w-4" />}
      />
    </div>
  );
}
