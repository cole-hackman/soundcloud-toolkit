"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Check, Heart, Music } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Button,
  Card,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageContainer,
  PageHeader,
  ProgressBar,
  ResultPanel,
  SelectableList,
  Skeleton,
  TrackRow,
  useAnnounce,
} from "@/components/ui";
import {
  usePlaylistsQuery,
  usePlaylistDetailQuery,
  invalidatePlaylistCaches,
  queryKeys,
} from "@/lib/queries";
import { asArray } from "@/lib/api-shape";

// SoundCloud bulk endpoints cap at 100 ids per request; chunk larger playlists.
const LIKE_BATCH_SIZE = 100;

interface PlaylistTrack {
  id: number;
  title?: string;
  user?: { username?: string };
  artwork_url?: string;
  duration?: number;
}

interface PlaylistOption {
  id: number;
  title: string;
  track_count: number;
  artwork_url?: string;
  coverUrl?: string;
}

interface LikeResult {
  liked: number;
  failed: number;
  total: number;
}

export default function PlaylistToLikesPage() {
  const queryClient = useQueryClient();
  const announce = useAnnounce();
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistOption | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<LikeResult | null>(null);

  const playlistsQuery = usePlaylistsQuery();
  const playlists = useMemo(
    () => asArray<PlaylistOption>(playlistsQuery.data?.collection),
    [playlistsQuery.data?.collection],
  );

  const detailQuery = usePlaylistDetailQuery(selectedPlaylist?.id ?? 0);
  const tracks = useMemo(
    () => asArray<PlaylistTrack>(detailQuery.data?.tracks),
    [detailQuery.data?.tracks],
  );

  // Default to liking every track in the playlist; users can deselect.
  useEffect(() => {
    if (tracks.length > 0) {
      setSelectedTracks(new Set(tracks.map((t) => t.id)));
    }
  }, [tracks]);

  useEffect(() => {
    if (playlistsQuery.isError) {
      setNotice({ type: "error", text: "Couldn’t load your playlists. Try refreshing the page." });
    }
  }, [playlistsQuery.isError]);

  // A playlist's tracks arriving is only a visual change; say how many.
  useEffect(() => {
    if (!selectedPlaylist || !detailQuery.isSuccess) return;
    announce(`${tracks.length} track${tracks.length === 1 ? "" : "s"} loaded`);
  }, [selectedPlaylist, detailQuery.isSuccess, tracks.length, announce]);

  // The success screen replaces the page, so focus its heading — otherwise
  // focus is left on a button that no longer exists.
  useEffect(() => {
    if (!result) return;
    successHeadingRef.current?.focus();
  }, [result]);

  const toggleTrack = (id: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTracks.size === tracks.length) setSelectedTracks(new Set());
    else setSelectedTracks(new Set(tracks.map((t) => t.id)));
  };

  const choosePlaylist = (p: PlaylistOption) => {
    setSelectedPlaylist(p);
    setSelectedTracks(new Set());
    setNotice(null);
    setResult(null);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleLike = async () => {
    const ids = Array.from(selectedTracks);
    if (ids.length === 0) return;
    setLiking(true);
    setNotice(null);
    setProgress({ done: 0, total: ids.length });

    let liked = 0;
    let failed = 0;
    try {
      for (let i = 0; i < ids.length; i += LIKE_BATCH_SIZE) {
        const batch = ids.slice(i, i + LIKE_BATCH_SIZE);
        const response = await apiFetch("/api/likes/tracks/bulk-like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: batch }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = typeof data?.error === "string" ? data.error : "Failed to like tracks";
          throw new Error(message);
        }
        const results = Array.isArray(data.results) ? data.results : [];
        liked += results.filter((r: { status: string }) => r.status === "ok").length;
        failed += results.filter((r: { status: string }) => r.status !== "ok").length;
        setProgress({ done: Math.min(i + batch.length, ids.length), total: ids.length });
      }

      // Liked tracks changed the user's likes; refresh caches that show them.
      await queryClient.invalidateQueries({ queryKey: queryKeys.likes() });
      await invalidatePlaylistCaches(queryClient, selectedPlaylist?.id ?? null);

      setResult({ liked, failed, total: ids.length });
      announce(
        `Liked ${liked} of ${ids.length} tracks${failed > 0 ? `, ${failed} failed` : ""}`,
        { assertive: true },
      );
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "An error occurred while liking tracks.",
      });
    } finally {
      setLiking(false);
      setProgress(null);
    }
  };

  // ── SUCCESS SCREEN ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="flex items-center justify-center px-6 py-6">
        <div className="max-w-2xl w-full text-center">
          <ResultPanel tone="success" className="p-5">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-lg">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h1
              ref={successHeadingRef}
              tabIndex={-1}
              className="text-2xl md:text-3xl font-bold mb-4 text-foreground focus:outline-none"
            >
              Tracks Liked!
            </h1>
            <p className="text-sm mb-6 text-muted-foreground">
              Liked {result.liked} track{result.liked !== 1 ? "s" : ""} from &quot;{selectedPlaylist?.title}&quot;.
              {result.failed > 0 && ` ${result.failed} could not be liked (they may be unavailable).`}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center px-8 py-3 rounded-lg font-semibold bg-gradient-to-r from-[#FF5500] to-[#E64A00] text-white hover:shadow-lg transition"
              >
                Back to Dashboard
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setResult(null);
                  setSelectedPlaylist(null);
                  setSelectedTracks(new Set());
                }}
                className="px-8"
              >
                Like Another Playlist
              </Button>
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
        title="Playlist → Likes"
        description="Like every track in a playlist at once. Pick a playlist, then like all its tracks (uncheck any you want to skip)."
      />

      {notice && (
        <InlineAlert variant={notice.type} className="mb-6" onDismiss={() => setNotice(null)}>
          {notice.text}
        </InlineAlert>
      )}

      {/* STEP 1: choose a playlist */}
      {!selectedPlaylist ? (
        <Card className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4">Choose a Playlist</h2>
          {playlistsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/50" />
              ))}
            </div>
          ) : playlists.length === 0 ? (
            <EmptyState icon={<Music className="w-12 h-12" />} title="No playlists found" />
          ) : (
            <div className="space-y-2 max-h-[60dvh] overflow-y-auto">
              {playlists.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => choosePlaylist(p)}
                  className="min-h-11 w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 dark:border-border hover:border-primary hover:bg-primary/5 transition text-left"
                >
                  <img
                    src={p.coverUrl || p.artwork_url || "/brand/icon-192.png"}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-foreground truncate">{p.title}</span>
                    <span className="block text-xs text-muted-foreground">{p.track_count} tracks</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Track list */}
          <div className="min-w-0 lg:col-span-2">
            <Card className="p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 break-words text-lg sm:text-xl font-bold text-foreground">
                  {selectedPlaylist.title}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    ({tracks.length})
                  </span>
                </h2>
                {tracks.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                    className="shrink-0 text-primary-text"
                  >
                    {selectedTracks.size === tracks.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>

              {detailQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/50" />
                  ))}
                </div>
              ) : tracks.length === 0 ? (
                <EmptyState icon={<Music className="w-12 h-12" />} title="This playlist has no tracks" />
              ) : (
                <SelectableList className="max-h-[60dvh] overflow-y-auto">
                  {tracks.map((track) => (
                    <TrackRow
                      as="li"
                      key={track.id}
                      track={{ ...track, title: track.title ?? "Untitled", subtitle: track.user?.username }}
                      isSelected={selectedTracks.has(track.id)}
                      onToggle={() => toggleTrack(track.id)}
                      rightSlot={
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(track.duration)}
                        </span>
                      }
                    />
                  ))}
                </SelectableList>
              )}
            </Card>
          </div>

          {/* Action panel */}
          <div className="min-w-0 lg:col-span-1">
            <Card className="space-y-5 p-4 sm:p-6 lg:sticky lg:top-24">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Like Tracks</h2>

              <div className="p-4 bg-gray-50 dark:bg-secondary/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Selected Tracks</div>
                <div className="text-2xl font-bold text-foreground">{selectedTracks.size}</div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPlaylist(null);
                  setSelectedTracks(new Set());
                }}
                className="text-primary-text"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Change playlist
              </Button>

              {/* Progress lives outside the button: a disabled control is
                  skipped by some assistive technology, so the only report of
                  a long job would never be read out. */}
              {liking && progress ? (
                <ProgressBar
                  label="Liking tracks"
                  value={progress.done}
                  max={progress.total}
                />
              ) : null}

              <Button
                onClick={handleLike}
                disabled={selectedTracks.size === 0 || liking}
                className="w-full gap-2"
              >
                {liking ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Liking…
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4" />
                    Like {selectedTracks.size} Track{selectedTracks.size !== 1 ? "s" : ""}
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Tracks are liked one at a time to stay within SoundCloud’s limits, so large playlists take a little while.
              </p>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
