"use client";

import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Search,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineAlert,
  Input,
  LoadingSpinner,
  PageHeader,
} from "@/components/ui";
import { invalidatePlaylistCaches, usePlaylistsQuery } from "@/lib/queries";

const PAGE_SIZE = 20;
/** Server caps a bulk remove at 200 tracks and 20 playlists per request. */
const MAX_REMOVE_TRACKS = 200;
const MAX_REMOVE_PLAYLISTS = 20;
/** Server caps a bulk add at 200 tracks per request. */
const MAX_ADD_TRACKS = 200;
/** Server rejects offsets past this, so the pager must stop there too. */
const MAX_OFFSET = 10000;
/** Server stops emitting matches past this; the page says so when it happens. */
const MAX_SEARCH_MATCHES = 2000;

interface Match {
  trackId: number;
  title: string;
  artist: string;
  permalink_url: string | null;
  /** 0-based index of this occurrence within its playlist. */
  position: number;
  playlistId: number;
  playlistTitle: string;
  keyword: string;
  matchedIn: "title" | "artist";
}

interface SearchPage {
  limit: number;
  offset: number;
  returned: number;
  total: number;
  hasMore: boolean;
  from: number;
  to: number;
  /** The playlist list came from cache and is being refreshed behind this response. */
  stale: boolean;
  /** The playlist crawl stopped early, so the library is bigger than `total`. */
  truncated: boolean;
}

interface SearchFailure {
  id: number;
  title: string | null;
}

interface SearchResult {
  keywords: string[];
  matches: Match[];
  stats: {
    playlistsSearched: number;
    tracksScanned: number;
    matchCount: number;
    uniqueTrackCount: number;
    playlistsFailed: number;
  };
  failed: SearchFailure[];
  /** True when `matches` was truncated at MAX_SEARCH_MATCHES. */
  capped: boolean;
  page: SearchPage | null;
}

/**
 * A match is one occurrence: the same track can appear in many playlists, and
 * more than once within a single playlist. Keying on the pair alone collapsed
 * those duplicates into one React key and one selection entry.
 */
const matchKey = (m: Match) => `${m.playlistId}:${m.trackId}:${m.position}`;

/** The (playlist, track) pair a set of duplicate rows share. */
const trackKey = (m: Match) => `${m.playlistId}:${m.trackId}`;

export default function PlaylistKeywordSearchPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<number | "all">("all");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copyTarget, setCopyTarget] = useState<number | "">("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: playlistsData } = usePlaylistsQuery();
  const playlists = useMemo(
    () => (playlistsData?.collection ?? []) as { id: number; title: string }[],
    [playlistsData],
  );

  const selectedMatches = useMemo(
    () => (result?.matches ?? []).filter((m) => selected.has(matchKey(m))),
    [result, selected],
  );
  const selectedTrackIds = useMemo(
    () => Array.from(new Set(selectedMatches.map((m) => m.trackId))),
    [selectedMatches],
  );
  const affectedPlaylistCount = useMemo(
    () => new Set(selectedMatches.map((m) => m.playlistId)).size,
    [selectedMatches],
  );

  const removeBlocked =
    selectedMatches.length > MAX_REMOVE_TRACKS || affectedPlaylistCount > MAX_REMOVE_PLAYLISTS;
  // Blocked rather than silently truncated: sending only the first 200 while
  // the button reads a larger number would quietly drop the rest.
  const copyBlocked = selectedTrackIds.length > MAX_ADD_TRACKS;

  const runSearch = async (nextOffset = 0) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setNotice({ type: "error", text: "Enter at least 2 characters." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({ q: trimmed });
      if (scope === "all") {
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(nextOffset));
      } else {
        params.set("playlistId", String(scope));
      }
      const response = await apiFetch(`/api/playlists/search-tracks?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: "error", text: data.error || "Search failed." });
        return;
      }
      setResult(data);
      setOffset(scope === "all" ? nextOffset : 0);
      // A new result set makes old selections meaningless.
      setSelected(new Set());
      const unreadable = data.stats.playlistsFailed ?? 0;
      setNotice({
        type: unreadable > 0 ? "error" : "success",
        text: `${data.stats.matchCount} match${data.stats.matchCount === 1 ? "" : "es"} across ${data.stats.playlistsSearched} playlist${data.stats.playlistsSearched === 1 ? "" : "s"} (${data.stats.tracksScanned} tracks scanned).${unreadable > 0 ? ` ${unreadable} playlist${unreadable === 1 ? "" : "s"} could not be read.` : ""}`,
      });
    } catch (error) {
      console.error("Keyword search failed:", error);
      setNotice({ type: "error", text: "Search failed. Try again." });
    } finally {
      setLoading(false);
    }
  };

  // Rows for the same track in the same playlist, grouped. The removal path can
  // only name track ids — the API replaces a playlist's whole list, so there is
  // no way to delete the second copy and keep the first — which means selecting
  // one copy necessarily selects them all. Making that explicit in the UI beats
  // letting the user believe otherwise and silently taking both.
  const siblingIndex = useMemo(() => {
    const byTrack = new Map<string, Match[]>();
    for (const m of result?.matches ?? []) {
      const key = trackKey(m);
      const group = byTrack.get(key);
      if (group) group.push(m);
      else byTrack.set(key, [m]);
    }
    return byTrack;
  }, [result]);

  const siblingsOf = (m: Match) => siblingIndex.get(trackKey(m)) ?? [m];

  // Virtualize the list. A broad keyword against fifty full playlists returns
  // up to MAX_SEARCH_MATCHES rows, and mounting two thousand labelled
  // checkboxes at once is what makes the page unusable rather than slow.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: result?.matches.length ?? 0,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 65, // ~64px row + 1px divider
    overscan: 8,
  });

  const toggle = (m: Match) => {
    const key = matchKey(m);
    const siblings = siblingsOf(m);
    setSelected((prev) => {
      const next = new Set(prev);
      const turningOn = !next.has(key);
      for (const sibling of siblings) {
        if (turningOn) next.add(matchKey(sibling));
        else next.delete(matchKey(sibling));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!result) return;
    setSelected(new Set(result.matches.map(matchKey)));
  };

  const removeSelected = async () => {
    setConfirmRemove(false);
    if (selectedMatches.length === 0) return;
    setWorking(true);
    setNotice(null);
    try {
      // Group by playlist — the API removes per playlist in one write each.
      const byPlaylist = new Map<number, number[]>();
      for (const m of selectedMatches) {
        const ids = byPlaylist.get(m.playlistId) ?? [];
        ids.push(m.trackId);
        byPlaylist.set(m.playlistId, ids);
      }
      const items = Array.from(byPlaylist.entries()).map(([playlistId, trackIds]) => ({
        playlistId,
        trackIds: Array.from(new Set(trackIds)),
      }));

      const response = await apiFetch("/api/playlists/tracks/bulk-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: "error", text: data.error || "Could not remove those tracks." });
        return;
      }

      // Track counts and playlist detail everywhere else in the app are now
      // wrong. Every other mutating page does this; without it a playlist this
      // page just edited still renders its pre-edit track list.
      await invalidatePlaylistCaches(queryClient);

      const results: { playlistId: number; status: string }[] = data.results ?? [];
      const failedPlaylists = new Set(
        results.filter((r) => r.status === "error").map((r) => r.playlistId),
      );
      setNotice({
        type: failedPlaylists.size ? "error" : "success",
        text: failedPlaylists.size
          ? `Removed ${data.removedTotal} track${data.removedTotal === 1 ? "" : "s"}. ${failedPlaylists.size} playlist${failedPlaylists.size === 1 ? "" : "s"} could not be updated — those matches are still listed and selected, so you can retry.`
          : `Removed ${data.removedTotal} track${data.removedTotal === 1 ? "" : "s"}.`,
      });

      // Drop only what actually went. Matches in a playlist whose write failed
      // are still in SoundCloud, so clearing them here would tell the user the
      // removal succeeded when it did not.
      const wasRemoved = (m: Match) => selected.has(matchKey(m)) && !failedPlaylists.has(m.playlistId);
      setResult((prev) =>
        prev ? { ...prev, matches: prev.matches.filter((m) => !wasRemoved(m)) } : prev,
      );
      // Keep the failed ones selected so a retry is one click.
      setSelected((prev) => {
        const next = new Set<string>();
        for (const m of selectedMatches) {
          if (failedPlaylists.has(m.playlistId) && prev.has(matchKey(m))) next.add(matchKey(m));
        }
        return next;
      });
    } catch (error) {
      console.error("Bulk remove failed:", error);
      setNotice({ type: "error", text: "Could not remove those tracks. Try again." });
    } finally {
      setWorking(false);
    }
  };

  const copySelected = async () => {
    if (copyTarget === "" || selectedTrackIds.length === 0 || copyBlocked) return;
    setWorking(true);
    setNotice(null);
    try {
      const response = await apiFetch("/api/playlists/tracks/bulk-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPlaylistId: Number(copyTarget),
          trackIds: selectedTrackIds,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: "error", text: data.error || "Could not copy those tracks." });
        return;
      }
      await invalidatePlaylistCaches(queryClient, Number(copyTarget));

      const extras = [
        data.alreadyPresent ? `${data.alreadyPresent} already there` : null,
        data.noRoom ? `${data.noRoom} did not fit` : null,
      ].filter(Boolean);
      setNotice({
        type: "success",
        text: `Added ${data.added} track${data.added === 1 ? "" : "s"} to ${data.targetTitle ?? "the playlist"}${extras.length ? ` (${extras.join(", ")})` : ""}.`,
      });
    } catch (error) {
      console.error("Bulk add failed:", error);
      setNotice({ type: "error", text: "Could not copy those tracks. Try again." });
    } finally {
      setWorking(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    downloadCsv("keyword-matches.csv", [
      ["track_id", "title", "artist", "playlist_id", "playlist", "keyword", "matched_in", "url"],
      ...result.matches.map((m) => [
        m.trackId,
        m.title,
        m.artist,
        m.playlistId,
        m.playlistTitle,
        m.keyword,
        m.matchedIn,
        m.permalink_url ?? "",
      ]),
    ]);
  };

  // Rendered on every result — including a page with no matches, where the
  // user still needs Next to reach the playlists further down their library.
  const pager = result?.page ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Searched playlists {result.page.from}–{result.page.to}
        {result.page.hasMore ? " — more to search" : " — end of your library"}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => runSearch(Math.max(0, offset - PAGE_SIZE))}
          disabled={loading || working || offset === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous {PAGE_SIZE}
        </Button>
        <Button
          variant="outline"
          onClick={() => runSearch(offset + PAGE_SIZE)}
          // The validator rejects offsets past MAX_OFFSET, so stop before
          // asking for one the API would 400 on.
          disabled={loading || working || !result.page.hasMore || offset + PAGE_SIZE > MAX_OFFSET}
        >
          Next {PAGE_SIZE}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-6">
        <PageHeader
          title="Keyword Search"
          description="Find tracks by keyword across your playlists, then remove them in bulk or copy them into another playlist. Separate terms with commas to match any of them."
        />

        {notice && (
          <InlineAlert variant={notice.type} className="mb-6" onDismiss={() => setNotice(null)}>
            {notice.text}
          </InlineAlert>
        )}

        <div className="mb-6 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) runSearch(0);
              }}
              placeholder="e.g. bootleg, remix, live"
              className="flex-1"
              aria-label="Keywords"
            />
            <select
              value={scope === "all" ? "all" : String(scope)}
              onChange={(e) => setScope(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              aria-label="Where to search"
            >
              <option value="all">All playlists</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <Button onClick={() => runSearch(0)} disabled={loading}>
              {loading ? <LoadingSpinner size="sm" className="border-white" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Matches track titles and artist names. Searching all playlists works {PAGE_SIZE} at a
            time to stay friendly to SoundCloud&apos;s rate limits.
          </p>
        </div>

        {!loading && result?.page?.stale && (
          <InlineAlert variant="info" className="mb-4">
            This list may be up to 15 minutes old — it is refreshing in the background.
          </InlineAlert>
        )}
        {!loading && result?.page?.truncated && (
          <InlineAlert variant="warning" className="mb-4">
            Not all playlists were indexed, so this search may not cover your whole library.
          </InlineAlert>
        )}
        {!loading && result && result.failed.length > 0 && (
          <InlineAlert variant="warning" className="mb-4">
            {result.failed.length} playlist{result.failed.length === 1 ? "" : "s"} could not be read
            — these results are incomplete.
          </InlineAlert>
        )}

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <LoadingSpinner />
          </div>
        ) : !result ? (
          <div className="rounded-xl border border-border bg-card p-8">
            <EmptyState
              icon={<Search className="h-12 w-12" />}
              title="No search yet"
              description="Enter a keyword to find matching tracks across your playlists."
            />
          </div>
        ) : result.matches.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-8">
              {/* Nothing was searched is not the same answer as nothing matched. */}
              {result.stats.playlistsSearched === 0 && result.failed.length > 0 ? (
                <EmptyState
                  icon={<Search className="h-12 w-12" />}
                  title="Nothing could be searched"
                  description={`None of the ${result.failed.length} playlist${result.failed.length === 1 ? "" : "s"} in this range could be read, so this is not a "no matches" result. Try again in a moment.`}
                />
              ) : (
                <EmptyState
                  icon={<Search className="h-12 w-12" />}
                  title="No matches"
                  description={
                    result.page?.hasMore
                      ? "Nothing in this batch of playlists. Use Next to search the following ones."
                      : "Nothing matched those keywords."
                  }
                />
              )}
            </div>
            {pager}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className="text-sm font-medium text-foreground">
                {selected.size} of {result.matches.length} selected
              </span>
              <Button variant="outline" onClick={selectAll} disabled={working}>
                Select all
              </Button>
              <Button variant="outline" onClick={() => setSelected(new Set())} disabled={working || selected.size === 0}>
                Clear
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <select
                  value={copyTarget === "" ? "" : String(copyTarget)}
                  onChange={(e) => setCopyTarget(e.target.value === "" ? "" : Number(e.target.value))}
                  className="rounded-lg border-2 border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  aria-label="Copy selected tracks to"
                >
                  <option value="">Copy to…</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  onClick={copySelected}
                  disabled={working || copyTarget === "" || selectedTrackIds.length === 0 || copyBlocked}
                >
                  <Copy className="h-4 w-4" />
                  Copy {selectedTrackIds.length || ""}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmRemove(true)}
                  disabled={working || selected.size === 0 || removeBlocked}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove {selected.size || ""}
                </Button>
              </div>
            </div>

            {removeBlocked && (
              <InlineAlert variant="error">
                Too many to remove at once — up to {MAX_REMOVE_TRACKS} tracks across{" "}
                {MAX_REMOVE_PLAYLISTS} playlists per batch. Deselect some and repeat.
              </InlineAlert>
            )}
            {copyBlocked && (
              <InlineAlert variant="error">
                Too many to copy at once — up to {MAX_ADD_TRACKS} unique tracks per batch.
                Deselect some and repeat.
              </InlineAlert>
            )}
            {result.capped && (
              <InlineAlert variant="warning">
                Showing the first {MAX_SEARCH_MATCHES.toLocaleString()} matches of{" "}
                {result.stats.matchCount.toLocaleString()} — narrow the search.
              </InlineAlert>
            )}

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                Matches
              </div>
              <div ref={listScrollRef} className="max-h-[600px] overflow-y-auto">
                <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const m = result.matches[virtualRow.index];
                    const key = matchKey(m);
                    const copies = siblingsOf(m).length;
                    return (
                      <div
                        key={key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <label className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 hover:bg-secondary/20">
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onChange={() => toggle(m)}
                            disabled={working}
                            className="h-4 w-4 accent-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-foreground">{m.title}</div>
                            <div className="truncate text-sm text-muted-foreground">
                              {m.artist} • in {m.playlistTitle}
                            </div>
                          </div>
                          {copies > 1 && (
                            <span className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                              ×{copies} in this playlist — removing removes every copy
                            </span>
                          )}
                          <span className="shrink-0 rounded-md border border-border bg-secondary/20 px-2 py-1 text-xs text-muted-foreground">
                            {m.keyword} in {m.matchedIn}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {pager}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${selected.size} track${selected.size === 1 ? "" : "s"}?`}
        description={`This removes them from ${affectedPlaylistCount} playlist${affectedPlaylistCount === 1 ? "" : "s"}. The tracks stay on SoundCloud and in your likes — only the playlist entries go. This can't be undone from here.`}
        confirmLabel="Remove"
        onConfirm={removeSelected}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}
