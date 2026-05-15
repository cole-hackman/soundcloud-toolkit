"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { Button, EmptyState, InlineAlert, LoadingSpinner } from "@/components/ui";
import { buildDatedFilename, downloadFile } from "@/lib/export";
import { ExportSection } from "./ExportSection";

const PREVIEW_LINE_COUNT = 10;

type Phase = "idle" | "loading" | "ready" | "empty" | "error";

export interface ListExportFormat {
  id: string;
  label: string;
  extension: "txt" | "csv";
  mime: string;
  build: (items: unknown[]) => string;
}

interface ListExportCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  fetchLabel: string;
  filenamePrefix: string;
  formats: ListExportFormat[];
  emptyTitle: string;
  emptyDescription: string;
  emptyLinkHref?: string;
  emptyLinkLabel?: string;
  loadItems: () => Promise<unknown[]>;
}

export function ListExportCard({
  icon,
  title,
  subtitle,
  description,
  fetchLabel,
  filenamePrefix,
  formats,
  emptyTitle,
  emptyDescription,
  emptyLinkHref,
  emptyLinkLabel,
  loadItems,
}: ListExportCardProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [items, setItems] = useState<unknown[]>([]);
  const [formatId, setFormatId] = useState(formats[0]?.id ?? "txt");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedFormat = formats.find((f) => f.id === formatId) ?? formats[0];

  const fetchAndPrepare = async () => {
    setPhase("loading");
    setErrorMessage(null);
    setItems([]);

    try {
      const loaded = await loadItems();
      if (loaded.length === 0) {
        setPhase("empty");
        return;
      }
      setItems(loaded);
      setPhase("ready");
    } catch (err) {
      console.error(`${title} export fetch failed:`, err);
      setPhase("error");
      setErrorMessage("Couldn't load data. Check your connection and try again.");
    }
  };

  const handleDownload = () => {
    if (items.length === 0 || !selectedFormat) return;
    const content = selectedFormat.build(items);
    downloadFile(
      content,
      buildDatedFilename(filenamePrefix, selectedFormat.extension),
      selectedFormat.mime
    );
  };

  const previewContent =
    items.length > 0 && selectedFormat ? selectedFormat.build(items) : "";
  const previewLines = previewContent.split("\n").filter((l) => l.length > 0).slice(0, PREVIEW_LINE_COUNT);
  const isLoading = phase === "loading";

  return (
    <ExportSection icon={icon} title={title} subtitle={subtitle} description={description}>
      {formats.length > 1 && (
        <div className="mt-4">
          <label htmlFor={`${filenamePrefix}-format`} className="text-xs font-medium text-muted-foreground">
            Format
          </label>
          <select
            id={`${filenamePrefix}-format`}
            value={formatId}
            onChange={(e) => setFormatId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            disabled={isLoading}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
            {items.length.toLocaleString()} item{items.length === 1 ? "" : "s"} ready
          </p>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Preview (first {PREVIEW_LINE_COUNT} lines)
            </p>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
              {previewLines.join("\n")}
              {items.length > PREVIEW_LINE_COUNT && (
                <span className="text-muted-foreground">
                  {`\n… and ${(items.length - PREVIEW_LINE_COUNT).toLocaleString()} more`}
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
            Fetching… This may take a while for large lists.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={fetchAndPrepare} disabled={isLoading} className="gap-2">
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

