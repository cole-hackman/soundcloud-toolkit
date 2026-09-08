"use client";

import { useMemo, useState } from "react";
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
import { usePlaylistsQuery } from "@/lib/queries";

const PAGE_SIZE = 20;
/** Server caps a bulk remove at 200 tracks and 20 playlists per request. */
const MAX_REMOVE_TRACKS = 200;
const MAX_REMOVE_PLAYLISTS = 20;
/** Server caps a bulk add at 200 tracks per request. */
const MAX_ADD_TRACKS = 200;
/** Server rejects offsets past this, so the pager must stop there too. */
const MAX_OFFSET = 10000;

interface Match {
  trackId: number;
  title: string;
  artist: string;
  permalink_url: string | null;
  playlistId: number;
  playlistTitle: string;
  keyword: string;
  matchedIn: "title" | "artist";
}

interface SearchPage {
  limit: number;
  offset: number;
  returned: number;
  hasMore: boolean;
  from: number;
  to: number;
}

interface SearchResult {
  keywords: string[];
  matches: Match[];
  stats: {
    playlistsSearched: number;
    tracksScanned: number;
    matchCount: number;
    uniqueTrackCount: number;
  };
  page: SearchPage | null;
}

/** A match is identified by the pair — the same track can match in many playlists. */
const matchKey = (m: Match) => `${m.playlistId}:${m.trackId}`;

export default function PlaylistKeywordSearchPage() {
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
      setNotice({
        type: "success",
        text: `${data.stats.matchCount} match${data.stats.matchCount === 1 ? "" : "es"} across ${data.stats.playlistsSearched} playlist${data.stats.playlistsSearched === 1 ? "" : "s"} (${data.stats.tracksScanned} tracks scanned).`,
      });
    } catch (error) {
      console.error("Keyword search failed:", error);
      setNotice({ type: "error", text: "Search failed. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const toggle = (m: Match) => {
    const key = matchKey(m);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                title="No matches"
                description={
                  result.page?.hasMore
                    ? "Nothing in this batch of playlists. Use Next to search the following ones."
                    : "Nothing matched those keywords."
                }
              />
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

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                Matches
              </div>
              <div className="divide-y divide-border">
                {result.matches.map((m) => {
                  const key = matchKey(m);
                  return (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-secondary/20"
                    >
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
                      <span className="shrink-0 rounded-md border border-border bg-secondary/20 px-2 py-1 text-xs text-muted-foreground">
                        {m.keyword} in {m.matchedIn}
                      </span>
                    </label>
                  );
                })}
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
