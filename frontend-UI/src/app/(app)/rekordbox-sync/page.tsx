"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Download,
  FileMusic,
  HelpCircle,
  Layers,
  Search,
  Upload,
} from "lucide-react";
import { apiFetchJson } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { usePlaylistsQuery, type PlaylistSummary } from "@/lib/queries";
import {
  Button,
  EmptyState,
  InlineAlert,
  LoadingSpinner,
  PageContainer,
  PageHeader,
} from "@/components/ui";
import {
  buildSyncReport,
  pairPlaylists,
  parseRekordboxXml,
  type MatchEntry,
  type RbTrackSummary,
  type RekordboxLibrary,
  type SyncReport,
} from "@/lib/rekordbox";

type Phase = "upload" | "configure" | "comparing" | "results";
type ResultTab = "missing" | "review" | "drift" | "rekordbox-only";

interface CollectionResponse<T> {
  collection: T[];
}

interface PlaylistDetail {
  id: number;
  title: string;
  tracks: Array<{ id: number } & Record<string, unknown>>;
}

/** Above this the browser is likely to struggle; warn rather than freeze silently. */
const LARGE_FILE_BYTES = 80 * 1024 * 1024;

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Let the browser paint between chunks of synchronous matching work. */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export default function RekordboxSyncPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [library, setLibrary] = useState<RekordboxLibrary | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);

  const [includeLikes, setIncludeLikes] = useState(true);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState("");

  const [report, setReport] = useState<SyncReport | null>(null);
  const [tab, setTab] = useState<ResultTab>("missing");
  const [filter, setFilter] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const playlistsQuery = usePlaylistsQuery({ enabled: phase !== "upload" });
  const playlists = useMemo(
    () => (playlistsQuery.data?.collection || []) as PlaylistSummary[],
    [playlistsQuery.data],
  );

  const readFile = useCallback(async (file: File) => {
    setError(null);
    setParsing(true);

    try {
      if (file.size > LARGE_FILE_BYTES) {
        setError(
          `That file is ${Math.round(file.size / 1024 / 1024)} MB. Very large collections may take a while or run out of memory in the browser.`,
        );
      }

      const text = await file.text();
      const parsed = parseRekordboxXml(text) as RekordboxLibrary;

      if (parsed.tracks.length === 0) {
        setError("That export parsed cleanly but contains no tracks.");
        setParsing(false);
        return;
      }

      setLibrary(parsed);
      setFileName(file.name);
      setPhase("configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) void readFile(file);
    },
    [readFile],
  );

  const togglePlaylist = (id: number) => {
    setSelectedPlaylistIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runComparison = async () => {
    if (!library) return;
    if (!includeLikes && selectedPlaylistIds.size === 0) {
      setError("Pick your likes, at least one playlist, or both.");
      return;
    }

    setPhase("comparing");
    setError(null);
    setReport(null);

    try {
      const sources: { id: string; label: string; tracks: unknown[] }[] = [];
      const scPlaylistsForPairing: { id: number; title: string }[] = [];
      const playlistTracks = new Map<number, unknown[]>();

      if (includeLikes) {
        setProgress("Loading your liked tracks…");
        const likes = await apiFetchJson<CollectionResponse<Record<string, unknown>>>("/api/likes");
        sources.push({ id: "likes", label: "Likes", tracks: likes.collection || [] });
      }

      const chosen = playlists.filter((playlist) => selectedPlaylistIds.has(playlist.id));
      for (const [position, playlist] of chosen.entries()) {
        setProgress(`Loading playlist ${position + 1} of ${chosen.length}: ${playlist.title}`);
        const detail = await apiFetchJson<PlaylistDetail>(`/api/playlists/${playlist.id}`);
        const tracks = detail.tracks || [];
        sources.push({ id: String(playlist.id), label: playlist.title, tracks });
        scPlaylistsForPairing.push({ id: playlist.id, title: playlist.title });
        playlistTracks.set(playlist.id, tracks);
      }

      // Pair the selected SoundCloud playlists with same-named rekordbox
      // crates so drift can be reported per playlist, not just per library.
      const paired = pairPlaylists(scPlaylistsForPairing, library.playlists) as {
        pairs: { soundcloud: { id: number; title: string }; rekordbox: RekordboxLibrary["playlists"][number] }[];
      };

      const playlistPairs = paired.pairs.map((pair) => ({
        source: {
          id: String(pair.soundcloud.id),
          label: pair.soundcloud.title,
          tracks: playlistTracks.get(pair.soundcloud.id) || [],
        },
        rbPlaylist: pair.rekordbox,
      }));

      setProgress(
        `Matching ${sources.reduce((sum, source) => sum + source.tracks.length, 0).toLocaleString()} tracks against ${library.tracks.length.toLocaleString()} in rekordbox…`,
      );
      // Matching is synchronous and can run for a second or two on a large
      // collection; yield first so the progress text actually renders.
      await yieldToBrowser();

      const result = buildSyncReport({ sources, library, playlistPairs }) as SyncReport;

      setReport(result);
      setTab("missing");
      setFilter("");
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed.");
      setPhase("configure");
    } finally {
      setProgress("");
    }
  };

  const reset = () => {
    setPhase("upload");
    setLibrary(null);
    setReport(null);
    setFileName("");
    setError(null);
    setSelectedPlaylistIds(new Set());
    setIncludeLikes(true);
  };

  // Deduplicated across sources: a track missing from both your likes and a
  // playlist is still one record to go and find.
  const missingEntries = useMemo(() => {
    if (!report) return [];
    const seen = new Map<number, MatchEntry & { sources: string[] }>();

    for (const comparison of report.comparisons) {
      for (const entry of comparison.missing) {
        const existing = seen.get(entry.track.id);
        if (existing) existing.sources.push(comparison.label);
        else seen.set(entry.track.id, { ...entry, sources: [comparison.label] });
      }
    }

    return [...seen.values()];
  }, [report]);

  const reviewEntries = useMemo(() => {
    if (!report) return [];
    const seen = new Map<number, MatchEntry & { sources: string[] }>();

    for (const comparison of report.comparisons) {
      for (const entry of comparison.review) {
        const existing = seen.get(entry.track.id);
        if (existing) existing.sources.push(comparison.label);
        else seen.set(entry.track.id, { ...entry, sources: [comparison.label] });
      }
    }

    return [...seen.values()];
  }, [report]);

  const needle = filter.trim().toLowerCase();
  const matchesFilter = (title: string, artist: string) =>
    !needle || title.toLowerCase().includes(needle) || artist.toLowerCase().includes(needle);

  const visibleMissing = missingEntries.filter((entry) =>
    matchesFilter(entry.track.title, entry.track.artist),
  );
  const visibleReview = reviewEntries.filter((entry) =>
    matchesFilter(entry.track.title, entry.track.artist),
  );
  const visibleRekordboxOnly = (report?.rekordboxOnly || []).filter((track) =>
    matchesFilter(track.title, track.artist),
  );

  const exportMissing = () => {
    downloadCsv("rekordbox-missing.csv", [
      ["title", "artist", "soundcloud_url", "free_download", "buy_link", "found_in"],
      ...missingEntries.map((entry) => [
        entry.track.title,
        entry.track.artist,
        entry.track.permalinkUrl,
        entry.track.downloadable ? "yes" : "no",
        entry.track.purchaseUrl,
        entry.sources.join(" / "),
      ]),
    ]);
  };

  const exportReview = () => {
    downloadCsv("rekordbox-review.csv", [
      ["soundcloud_title", "soundcloud_artist", "rekordbox_title", "rekordbox_artist", "confidence", "soundcloud_url"],
      ...reviewEntries.map((entry) => [
        entry.track.title,
        entry.track.artist,
        entry.rekordbox?.title || "",
        entry.rekordbox?.artist || "",
        entry.score,
        entry.track.permalinkUrl,
      ]),
    ]);
  };

  const exportRekordboxOnly = () => {
    downloadCsv("rekordbox-only.csv", [
      ["title", "artist", "bpm", "key", "genre", "date_added", "play_count"],
      ...(report?.rekordboxOnly || []).map((track) => [
        track.title,
        track.artist,
        track.bpm ?? "",
        track.key,
        track.genre,
        track.dateAdded,
        track.playCount ?? "",
      ]),
    ]);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Rekordbox Sync"
        description="Compare your SoundCloud likes and playlists against your rekordbox collection to see what you've saved but never imported."
      />

      {error && (
        <div className="mb-6">
          <InlineAlert variant={library ? "error" : "warning"}>{error}</InlineAlert>
        </div>
      )}

      {phase === "upload" && (
        <UploadStep
          dragging={dragging}
          parsing={parsing}
          fileInputRef={fileInputRef}
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onPick={(file) => void readFile(file)}
        />
      )}

      {phase === "configure" && library && (
        <ConfigureStep
          library={library}
          fileName={fileName}
          playlists={playlists}
          playlistsLoading={playlistsQuery.isLoading}
          includeLikes={includeLikes}
          selectedPlaylistIds={selectedPlaylistIds}
          onToggleLikes={() => setIncludeLikes((value) => !value)}
          onTogglePlaylist={togglePlaylist}
          onSelectAll={() => setSelectedPlaylistIds(new Set(playlists.map((p) => p.id)))}
          onClearAll={() => setSelectedPlaylistIds(new Set())}
          onRun={() => void runComparison()}
          onReset={reset}
        />
      )}

      {phase === "comparing" && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-16">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">{progress || "Working…"}</p>
          <p className="max-w-md text-center text-xs text-muted-foreground">
            Large libraries take a moment — the whole comparison runs in your browser.
          </p>
        </div>
      )}

      {phase === "results" && report && (
        <div className="space-y-6">
          <SummaryCards report={report} />

          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <TabButton active={tab === "missing"} onClick={() => setTab("missing")} count={missingEntries.length}>
              Missing from rekordbox
            </TabButton>
            <TabButton active={tab === "review"} onClick={() => setTab("review")} count={reviewEntries.length}>
              Needs review
            </TabButton>
            <TabButton active={tab === "drift"} onClick={() => setTab("drift")} count={report.drift.length}>
              Playlist drift
            </TabButton>
            <TabButton
              active={tab === "rekordbox-only"}
              onClick={() => setTab("rekordbox-only")}
              count={report.rekordboxOnly.length}
            >
              Only in rekordbox
            </TabButton>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="secondary" onClick={reset}>
                Start over
              </Button>
            </div>
          </div>

          {tab !== "drift" && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by title or artist…"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground"
              />
            </div>
          )}

          {tab === "missing" && (
            <MissingTab entries={visibleMissing} total={missingEntries.length} onExport={exportMissing} />
          )}
          {tab === "review" && (
            <ReviewTab entries={visibleReview} total={reviewEntries.length} onExport={exportReview} />
          )}
          {tab === "drift" && <DriftTab report={report} />}
          {tab === "rekordbox-only" && (
            <RekordboxOnlyTab
              tracks={visibleRekordboxOnly}
              total={report.rekordboxOnly.length}
              onExport={exportRekordboxOnly}
            />
          )}
        </div>
      )}
    </PageContainer>
  );
}

function UploadStep({
  dragging,
  parsing,
  fileInputRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onPick,
}: {
  dragging: boolean;
  parsing: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onPick: (file: File) => void;
}) {
  return (
    <div className="space-y-6">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner />
            <p className="text-sm text-muted-foreground">Reading your collection…</p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Drop your rekordbox collection</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              An XML export of your library. Nothing is uploaded — the file is read and compared entirely
              in this browser tab.
            </p>
            <Button className="mt-6 gap-2" onClick={() => fileInputRef.current?.click()}>
              <FileMusic className="h-4 w-4" />
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onPick(file);
                event.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <HelpCircle className="h-4 w-4" />
          Getting the file out of rekordbox
        </h3>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Open rekordbox on your computer.</li>
          <li>
            Go to <span className="font-medium text-foreground">File → Export Collection in xml format</span>.
          </li>
          <li>Save it anywhere, then drop it above.</li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          This tool only ever reads that file. It does not touch your rekordbox database, your cue points,
          or the music files on your drive.
        </p>
      </div>
    </div>
  );
}

function ConfigureStep({
  library,
  fileName,
  playlists,
  playlistsLoading,
  includeLikes,
  selectedPlaylistIds,
  onToggleLikes,
  onTogglePlaylist,
  onSelectAll,
  onClearAll,
  onRun,
  onReset,
}: {
  library: RekordboxLibrary;
  fileName: string;
  playlists: PlaylistSummary[];
  playlistsLoading: boolean;
  includeLikes: boolean;
  selectedPlaylistIds: Set<number>;
  onToggleLikes: () => void;
  onTogglePlaylist: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{fileName}</p>
            <p className="text-sm text-muted-foreground">
              {library.tracks.length.toLocaleString()} tracks · {library.playlists.length.toLocaleString()}{" "}
              playlists
              {library.meta.product && ` · ${library.meta.product} ${library.meta.version}`}
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={onReset}>
          Use a different file
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">What should I compare?</h3>

        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted/40">
          <input type="checkbox" checked={includeLikes} onChange={onToggleLikes} className="h-4 w-4" />
          <div>
            <p className="text-sm font-medium text-foreground">Liked tracks</p>
            <p className="text-xs text-muted-foreground">
              Everything you&apos;ve hearted on SoundCloud. This is usually the interesting one.
            </p>
          </div>
        </label>

        <div className="mt-6 flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Playlists</h4>
          {playlists.length > 0 && (
            <div className="flex gap-2">
              <button type="button" onClick={onSelectAll} className="text-xs text-primary hover:underline">
                Select all
              </button>
              <button type="button" onClick={onClearAll} className="text-xs text-primary hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>

        {playlistsLoading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : playlists.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No playlists found on your account.</p>
        ) : (
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {playlists.map((playlist) => (
              <label
                key={playlist.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={selectedPlaylistIds.has(playlist.id)}
                  onChange={() => onTogglePlaylist(playlist.id)}
                  className="h-4 w-4"
                />
                <span className="flex-1 truncate text-sm text-foreground">{playlist.title}</span>
                <span className="text-xs text-muted-foreground">{playlist.track_count}</span>
              </label>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Playlists whose names match a rekordbox crate are compared against it directly, so you also get a
          per-playlist drift report.
        </p>

        <Button className="mt-6 gap-2" onClick={onRun}>
          <ArrowRightLeft className="h-4 w-4" />
          Compare
        </Button>
      </div>
    </div>
  );
}

function SummaryCards({ report }: { report: SyncReport }) {
  const cards = [
    { label: "Checked on SoundCloud", value: report.totals.soundcloudTracks },
    { label: "Missing from rekordbox", value: report.totals.uniqueMissing, accent: true },
    { label: "Needs review", value: report.totals.needsReview },
    { label: "Only in rekordbox", value: report.totals.rekordboxOnly },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-border bg-card p-4">
          <p className={`text-2xl font-semibold ${card.accent ? "text-primary" : "text-foreground"}`}>
            {card.value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
      <span className={`ml-2 text-xs ${active ? "opacity-80" : "opacity-60"}`}>{count.toLocaleString()}</span>
    </button>
  );
}

function ExportBar({
  shown,
  total,
  onExport,
  label,
}: {
  shown: number;
  total: number;
  onExport: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {shown === total
          ? `${total.toLocaleString()} ${label}`
          : `${shown.toLocaleString()} of ${total.toLocaleString()} ${label}`}
      </p>
      {total > 0 && (
        <Button variant="secondary" onClick={onExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      )}
    </div>
  );
}

function MissingTab({
  entries,
  total,
  onExport,
}: {
  entries: (MatchEntry & { sources: string[] })[];
  total: number;
  onExport: () => void;
}) {
  if (total === 0) {
    return (
      <EmptyState
        icon={<Check className="h-6 w-6" />}
        title="Nothing missing"
        description="Everything you checked on SoundCloud already has a match in your rekordbox collection."
      />
    );
  }

  return (
    <div className="space-y-4">
      <ExportBar shown={entries.length} total={total} onExport={onExport} label="tracks to track down" />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {entries.map((entry) => (
          <div key={entry.track.id} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{entry.track.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.track.artist} · {formatDuration(entry.track.durationMs)} ·{" "}
                <span className="opacity-75">in {entry.sources.join(", ")}</span>
              </p>
            </div>

            {entry.track.downloadable && (
              <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                Free download
              </span>
            )}
            {!entry.track.downloadable && entry.track.purchaseUrl && (
              <a
                href={entry.track.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Buy
              </a>
            )}

            {entry.track.permalinkUrl && (
              <a
                href={entry.track.permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                Open
              </a>
            )}
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches that filter.</p>
      )}
    </div>
  );
}

function ReviewTab({
  entries,
  total,
  onExport,
}: {
  entries: (MatchEntry & { sources: string[] })[];
  total: number;
  onExport: () => void;
}) {
  if (total === 0) {
    return (
      <EmptyState
        icon={<Check className="h-6 w-6" />}
        title="No ambiguous matches"
        description="Every track was either a confident match or a clear miss."
      />
    );
  }

  return (
    <div className="space-y-4">
      <InlineAlert variant="info">
        These matched on title but the artist or runtime disagreed — often a label upload, an alias, or a
        different edit. Check them before treating them as missing.
      </InlineAlert>

      <ExportBar shown={entries.length} total={total} onExport={onExport} label="possible matches" />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {entries.map((entry) => (
          <div key={entry.track.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{entry.track.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.track.artist} · SoundCloud
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {Math.round(entry.score * 100)}%
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{entry.rekordbox?.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.rekordbox?.artist} · rekordbox
                {entry.durationDeltaMs !== null && entry.durationDeltaMs > 20000 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    runtime differs by {formatDuration(entry.durationDeltaMs)}
                  </span>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches that filter.</p>
      )}
    </div>
  );
}

function DriftTab({ report }: { report: SyncReport }) {
  if (report.drift.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-6 w-6" />}
        title="No paired playlists"
        description="Select some SoundCloud playlists whose names match a rekordbox crate, and their differences will show up here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {report.drift.map((pair) => (
        <div key={`${pair.soundcloud.id}-${pair.rekordbox.path}`} className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {pair.soundcloud.title}
              <span className="mx-2 font-normal text-muted-foreground">↔</span>
              {pair.rekordbox.path}
            </h3>
            <p className="text-xs text-muted-foreground">
              {pair.summary.inBoth} in both · {pair.soundcloud.trackCount} on SoundCloud ·{" "}
              {pair.rekordbox.trackCount} in rekordbox
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <DriftColumn
              title="Not in your collection"
              hint="Download or buy these"
              items={pair.missingFromLibrary.map((entry) => `${entry.track.title} — ${entry.track.artist}`)}
            />
            <DriftColumn
              title="Owned, not in this crate"
              hint="Just drag them in"
              items={pair.inLibraryNotPlaylist.map(
                (entry) => `${entry.rekordbox?.title || entry.track.title} — ${entry.rekordbox?.artist || entry.track.artist}`,
              )}
            />
            <DriftColumn
              title="Only in rekordbox"
              hint="Not on the SoundCloud side"
              items={pair.onlyInRekordbox.map((track) => `${track.title} — ${track.artist}`)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DriftColumn({ title, hint, items }: { title: string; hint: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground opacity-75">{hint}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{items.length}</p>

      {items.length > 0 && (
        <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="truncate">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RekordboxOnlyTab({
  tracks,
  total,
  onExport,
}: {
  tracks: RbTrackSummary[];
  total: number;
  onExport: () => void;
}) {
  if (total === 0) {
    return (
      <EmptyState
        icon={<Check className="h-6 w-6" />}
        title="Nothing unaccounted for"
        description="Every track in your rekordbox collection matched something on the SoundCloud side."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        In your collection but not in anything you checked on SoundCloud — bought elsewhere, promos, or
        tracks you never got round to liking.
      </p>

      <ExportBar shown={tracks.length} total={total} onExport={onExport} label="tracks" />

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {tracks.slice(0, 500).map((track) => (
          <div key={track.rbId} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{track.title}</p>
              <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {track.bpm ? `${Math.round(track.bpm)} BPM` : ""}
              {track.key ? ` · ${track.key}` : ""}
            </div>
          </div>
        ))}
      </div>

      {tracks.length > 500 && (
        <p className="text-center text-xs text-muted-foreground">
          Showing the first 500. Export the CSV for the full list.
        </p>
      )}

      {tracks.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches that filter.</p>
      )}
    </div>
  );
}
