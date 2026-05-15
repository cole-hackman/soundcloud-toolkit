"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { Button, EmptyState, InlineAlert, LoadingSpinner } from "@/components/ui";
import {
  buildDatedFilename,
  buildExportContent,
  downloadFile,
  type ExportTrack,
  type TrackExportFormat,
  TRACK_FORMAT_LABELS,
} from "@/lib/export";
import { ExportSection } from "./ExportSection";

const PREVIEW_LINE_COUNT = 10;

type Phase = "idle" | "loading" | "ready" | "empty" | "error";

interface TrackExportCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  fetchLabel: string;
  filenamePrefix: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyLinkHref?: string;
  emptyLinkLabel?: string;
  loadTracks: () => Promise<ExportTrack[]>;
  extraControls?: React.ReactNode;
  fetchDisabled?: boolean;
}

export function TrackExportCard({
  icon,
  title,
  subtitle,
  description,
  fetchLabel,
  filenamePrefix,
  emptyTitle,
  emptyDescription,
  emptyLinkHref,
  emptyLinkLabel,
  loadTracks,
  extraControls,
  fetchDisabled = false,
}: TrackExportCardProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [tracks, setTracks] = useState<ExportTrack[]>([]);
  const [format, setFormat] = useState<TrackExportFormat>("title-artist");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAndPrepare = async () => {
    setPhase("loading");
    setErrorMessage(null);
    setTracks([]);

    try {
      const loaded = await loadTracks();
      if (loaded.length === 0) {
        setPhase("empty");
        return;
      }
      setTracks(loaded);
      setPhase("ready");
    } catch (err) {
      console.error(`${title} export fetch failed:`, err);
      setPhase("error");
      setErrorMessage("Couldn't load data. Check your connection and try again.");
    }
  };

  const handleDownload = () => {
    if (tracks.length === 0) return;
    const { content, extension, mime } = buildExportContent(tracks, format);
    downloadFile(content, buildDatedFilename(filenamePrefix, extension), mime);
  };

  const previewContent = tracks.length > 0 ? buildExportContent(tracks, format).content : "";
  const previewLines = previewContent.split("\n").filter((l) => l.length > 0).slice(0, PREVIEW_LINE_COUNT);
  const isLoading = phase === "loading";

  return (
    <ExportSection icon={icon} title={title} subtitle={subtitle} description={description}>
      {extraControls}

      <div className="mt-4">
        <label htmlFor={`${filenamePrefix}-format`} className="text-xs font-medium text-muted-foreground">
          Format
        </label>
        <select
          id={`${filenamePrefix}-format`}
          value={format}
          onChange={(e) => setFormat(e.target.value as TrackExportFormat)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          disabled={isLoading}
        >
          {(Object.keys(TRACK_FORMAT_LABELS) as TrackExportFormat[]).map((key) => (
            <option key={key} value={key}>
              {TRACK_FORMAT_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {phase === "error" && errorMessage && (
        <div className="mt-4">
          <InlineAlert variant="error">{errorMessage}</InlineAlert>
        </div>
      )}

      {phase === "empty" && (
        <div className="mt-6">
          <EmptyState
            icon={icon}
            title={emptyTitle}
            description={emptyDescription}
            action={
              emptyLinkHref && emptyLinkLabel ? (
                <Link href={emptyLinkHref} className="text-sm font-medium text-primary hover:underline">
                  {emptyLinkLabel}
                </Link>
              ) : undefined
            }
          />
        </div>
      )}

      {phase === "ready" && (
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">
            {tracks.length.toLocaleString()} track{tracks.length === 1 ? "" : "s"} ready
          </p>
          {tracks.length > 5000 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Large list — download may take a moment to generate.
            </p>
          )}
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Preview (first {PREVIEW_LINE_COUNT} lines)
            </p>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
              {previewLines.join("\n")}
              {tracks.length > PREVIEW_LINE_COUNT && (
                <span className="text-muted-foreground">
                  {`\n… and ${(tracks.length - PREVIEW_LINE_COUNT).toLocaleString()} more`}
                </span>
              )}
            </pre>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-6 flex flex-col items-center gap-3 py-6">
          <LoadingSpinner />
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Fetching… This may take a while for large libraries.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={fetchAndPrepare} disabled={isLoading || fetchDisabled} className="gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching…
            </>
          ) : phase === "ready" ? (
            "Refresh list"
          ) : (
            fetchLabel
          )}
        </Button>

        {phase === "ready" && (
          <Button variant="secondary" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
        )}

        {phase === "error" && (
          <Button variant="secondary" onClick={fetchAndPrepare} disabled={isLoading}>
            Retry
          </Button>
        )}
      </div>
    </ExportSection>
  );
}
