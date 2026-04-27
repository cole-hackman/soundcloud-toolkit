"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Download, ListPlus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, EmptyState, InlineAlert, LoadingSpinner, PageHeader } from "@/components/ui";

interface Playlist {
  id: number;
  title: string;
  track_count: number;
}

interface Track {
  id: number;
  title?: string;
  user?: { username?: string };
}

interface CompareResult {
  summary: {
    playlistA: { id: number; title: string; trackCount: number };
    playlistB: { id: number; title: string; trackCount: number };
    overlapCount: number;
    uniqueToACount: number;
    uniqueToBCount: number;
    overlapPercent: number;
  };
  overlap: Track[];
  uniqueToA: Track[];
  uniqueToB: Track[];
}

export default function PlaylistComparePage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistAId, setPlaylistAId] = useState<number | "">("");
  const [playlistBId, setPlaylistBId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await apiFetch("/api/playlists");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load playlists");
      setPlaylists(data.collection || []);
    } catch (error) {
      console.error("Failed to load playlists:", error);
      setNotice({ type: "error", text: "Could not load playlists. Try refreshing." });
    } finally {
      setLoading(false);
    }
  };

  const compare = async () => {
    if (!playlistAId || !playlistBId || playlistAId === playlistBId) return;
    setComparing(true);
    setNotice(null);
    setResult(null);
    try {
      const response = await apiFetch("/api/playlists/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistAId, playlistBId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not compare playlists");
      setResult(data);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Could not compare playlists." });
    } finally {
      setComparing(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const rows = [
      ["section", "track_id", "title", "artist"],
      ...result.overlap.map((track) => ["overlap", track.id, track.title || "", track.user?.username || ""]),
      ...result.uniqueToA.map((track) => ["unique_to_a", track.id, track.title || "", track.user?.username || ""]),
      ...result.uniqueToB.map((track) => ["unique_to_b", track.id, track.title || "", track.user?.username || ""]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "playlist-comparison.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-6">
        <PageHeader
          title="Playlist Compare"
          description="Compare two playlists to find overlap and tracks missing from either side."
        />

        {notice && (
          <InlineAlert variant={notice.type} className="mb-6" onDismiss={() => setNotice(null)}>
            {notice.text}
          </InlineAlert>
        )}

        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <PlaylistSelect label="Playlist A" value={playlistAId} playlists={playlists} onChange={setPlaylistAId} />
              <PlaylistSelect label="Playlist B" value={playlistBId} playlists={playlists} onChange={setPlaylistBId} />
              <div className="flex items-end">
                <Button onClick={compare} disabled={comparing || !playlistAId || !playlistBId || playlistAId === playlistBId}>
                  {comparing ? <LoadingSpinner size="sm" className="border-white" /> : <ArrowRightLeft className="h-4 w-4" />}
                  Compare
                </Button>
              </div>
            </div>
          )}
        </div>

        {!result ? (
          <div className="rounded-xl border border-border bg-card p-8">
            <EmptyState
              icon={<ArrowRightLeft className="h-12 w-12" />}
              title="Choose two playlists"
              description="The comparison will show shared tracks and tracks unique to each playlist."
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Overlap" value={`${result.summary.overlapCount}`} detail={`${result.summary.overlapPercent}% of combined tracks`} />
              <Metric label="Only in A" value={`${result.summary.uniqueToACount}`} detail={result.summary.playlistA.title} />
              <Metric label="Only in B" value={`${result.summary.uniqueToBCount}`} detail={result.summary.playlistB.title} />
              <div className="rounded-xl border border-border bg-card p-4">
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            <TrackSection title={`Only in ${result.summary.playlistA.title}`} tracks={result.uniqueToA} />
            <TrackSection title={`Only in ${result.summary.playlistB.title}`} tracks={result.uniqueToB} />
            <TrackSection title="In both playlists" tracks={result.overlap} />

            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <ListPlus className="mr-2 inline h-4 w-4 text-[#FF5500]" />
              Next step: use Combine Playlists or Playlist Modifier to add missing tracks after reviewing the export.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistSelect({
  label,
  value,
  playlists,
  onChange,
}: {
  label: string;
  value: number | "";
  playlists: Playlist[];
  onChange: (value: number | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : "")}
        className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm text-[#333333] focus:border-[#FF5500] focus:outline-none dark:border-border dark:bg-secondary/20 dark:text-foreground"
      >
        <option value="">Choose a playlist...</option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.title} ({playlist.track_count} tracks)
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function TrackSection({ title, tracks }: { title: string; tracks: Track[] }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
        {title} ({tracks.length})
      </div>
      <div className="max-h-80 divide-y divide-border overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">No tracks in this group.</div>
        ) : (
          tracks.map((track) => (
            <div key={track.id} className="px-4 py-3">
              <div className="font-medium text-foreground">{track.title || `Track ${track.id}`}</div>
              {track.user?.username && <div className="text-sm text-muted-foreground">{track.user.username}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
