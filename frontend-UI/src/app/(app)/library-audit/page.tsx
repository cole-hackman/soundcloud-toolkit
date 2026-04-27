"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, Download, ListChecks, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { Button, EmptyState, InlineAlert, LoadingSpinner, PageHeader } from "@/components/ui";

interface AuditPlaylist {
  id: number;
  title: string;
  trackCount: number;
  summary: {
    totalTracks: number;
    duplicateTracks: number;
    unavailableTracks: number;
    directDownloads: number;
    purchaseLinks: number;
    nearCap: boolean;
  };
}

interface AuditResult {
  summary: {
    playlists: number;
    tracks: number;
    duplicates: number;
    unavailable: number;
    directDownloads: number;
    purchaseLinks: number;
    nearCap: number;
  };
  playlists: AuditPlaylist[];
}

export default function LibraryAuditPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await apiFetch("/api/library/audit?limit=20");
      const data = await response.json();
      if (!response.ok) {
        setNotice({ type: "error", text: data.error || "Could not run the audit." });
        return;
      }
      setResult(data);
      setNotice({ type: "success", text: `Audited ${data.summary.playlists} playlist${data.summary.playlists === 1 ? "" : "s"}.` });
    } catch (error) {
      console.error("Library audit failed:", error);
      setNotice({ type: "error", text: "Could not run the audit. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const rows = [
      ["playlist_id", "title", "tracks", "duplicates", "unavailable", "direct_downloads", "purchase_links", "near_cap"],
      ...result.playlists.map((playlist) => [
        playlist.id,
        playlist.title,
        playlist.summary.totalTracks,
        playlist.summary.duplicateTracks,
        playlist.summary.unavailableTracks,
        playlist.summary.directDownloads,
        playlist.summary.purchaseLinks,
        playlist.summary.nearCap ? "yes" : "no",
      ]),
    ];
    downloadCsv("library-audit.csv", rows);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-6 py-6">
        <PageHeader
          title="Library Audit"
          description="Scan playlists for duplicates, unavailable tracks, download links, and playlists near SoundCloud’s 500-track cap."
        />

        {notice && (
          <InlineAlert variant={notice.type} className="mb-6" onDismiss={() => setNotice(null)}>
            {notice.text}
          </InlineAlert>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Button onClick={runAudit} disabled={loading}>
            {loading ? <LoadingSpinner size="sm" className="border-white" /> : <RefreshCw className="h-4 w-4" />}
            Run playlist audit
          </Button>
          {result && (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            The MVP scans up to 20 playlists per run to stay friendly to SoundCloud rate limits.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <LoadingSpinner />
          </div>
        ) : !result ? (
          <div className="rounded-xl border border-border bg-card p-8">
            <EmptyState
              icon={<ListChecks className="h-12 w-12" />}
              title="No audit yet"
              description="Run an audit to see which playlists need cleanup."
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Playlists" value={result.summary.playlists} />
              <Metric label="Tracks scanned" value={result.summary.tracks} />
              <Metric label="Duplicates" value={result.summary.duplicates} tone={result.summary.duplicates > 0 ? "warn" : "ok"} />
              <Metric label="Unavailable" value={result.summary.unavailable} tone={result.summary.unavailable > 0 ? "warn" : "ok"} />
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                Playlist findings
              </div>
              <div className="divide-y divide-border">
                {result.playlists.map((playlist) => {
                  const hasIssues =
                    playlist.summary.duplicateTracks > 0 ||
                    playlist.summary.unavailableTracks > 0 ||
                    playlist.summary.nearCap;
                  return (
                    <div key={playlist.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-foreground">{playlist.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {playlist.summary.totalTracks} tracks • {playlist.summary.directDownloads} direct downloads • {playlist.summary.purchaseLinks} purchase links
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Finding label={`${playlist.summary.duplicateTracks} duplicates`} active={playlist.summary.duplicateTracks > 0} />
                        <Finding label={`${playlist.summary.unavailableTracks} unavailable`} active={playlist.summary.unavailableTracks > 0} />
                        <Finding label={playlist.summary.nearCap ? "near cap" : "under cap"} active={playlist.summary.nearCap} />
                        {hasIssues ? <AlertTriangle className="h-4 w-4 text-yellow-600" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={`text-2xl font-bold ${tone === "warn" ? "text-yellow-700 dark:text-yellow-400" : tone === "ok" ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function Finding({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`rounded-md border px-2 py-1 ${active ? "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300" : "border-border bg-secondary/20 text-muted-foreground"}`}>
      {label}
    </span>
  );
}
