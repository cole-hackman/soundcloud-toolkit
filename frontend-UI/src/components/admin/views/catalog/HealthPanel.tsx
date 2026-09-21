"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Play, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAbsolute, fmtInt, timeAgo } from "../../format";
import { Empty, ErrorNotice, Panel, RowSkeleton, Segmented, SmallButton, TableShell, tdClass, thClass } from "../../primitives";
import { CATALOG_PAGE_SIZE, useCatalogTracks, useReResolve } from "../../queries";
import type { CatalogFilter, CatalogSummary, Period } from "../../types";
import { Pager } from "./shared";
import { TrackPlayer } from "./TrackPlayer";

export type HealthState = "blocked" | "preview" | "gone" | "pending" | "not_found";

const STATES: ReadonlyArray<{ value: HealthState; label: string; kind: "access" | "resolve"; hint: string }> = [
  { value: "blocked", label: "Blocked", kind: "access", hint: "SoundCloud reports the track as blocked in the requesting region." },
  { value: "preview", label: "Preview", kind: "access", hint: "Only a preview snippet is streamable." },
  { value: "gone", label: "Gone", kind: "access", hint: "The track no longer exists upstream; metadata is kept as last seen." },
  { value: "pending", label: "Pending", kind: "resolve", hint: "Seen only as an id so far; enrichment has not fetched it yet." },
  { value: "not_found", label: "Not found", kind: "resolve", hint: "Three enrichment attempts came back empty." },
];

const RE_RESOLVE_CAP = 200;

interface Props {
  period: Period;
  enabled: boolean;
  summary: CatalogSummary | undefined;
  state: HealthState;
  onStateChange: (state: HealthState) => void;
}

export function HealthPanel({ period, enabled, summary, state, onStateChange }: Props) {
  const meta = STATES.find((s) => s.value === state) ?? STATES[0];
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [state, period]);

  const filter: CatalogFilter = React.useMemo(
    () => ({
      genre: "",
      artist: "",
      access: meta.kind === "access" ? state : "",
      resolveStatus: meta.kind === "resolve" ? state : "",
      action: "",
      sort: "touches",
      order: "desc",
      page,
    }),
    [meta.kind, state, page],
  );
  const q = useCatalogTracks(period, filter, enabled);
  const rows = q.data?.tracks ?? [];
  const total = q.data?.total ?? 0;

  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  React.useEffect(() => setSelected(new Set()), [state, period, page]);
  // One embedded player at a time; a blocked track's widget shows SoundCloud's
  // own message, which is the quickest confirmation of what the catalog says.
  const [playing, setPlaying] = React.useState<string | null>(null);
  React.useEffect(() => setPlaying(null), [state, period, page]);
  const pageIds = rows.map((t) => String(t.id));
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(pageIds));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reResolve = useReResolve();
  const [lastResult, setLastResult] = React.useState<{ requested: number; fetched: number; missing: number; at: number } | null>(null);
  const run = (ids: string[]) => {
    if (ids.length === 0 || reResolve.isPending) return;
    reResolve.mutate(ids.slice(0, RE_RESOLVE_CAP), {
      onSuccess: (r) => {
        setLastResult({ requested: r.requested, fetched: r.fetched, missing: r.missing, at: Date.now() });
        setSelected(new Set());
      },
    });
  };

  const counts: Record<HealthState, number> = {
    blocked: summary?.accessBreakdown?.blocked ?? 0,
    preview: summary?.accessBreakdown?.preview ?? 0,
    gone: summary?.accessBreakdown?.gone ?? 0,
    pending: summary?.resolveBreakdown?.pending ?? 0,
    not_found: summary?.resolveBreakdown?.not_found ?? 0,
  };

  return (
    <Panel
      index={4}
      title="Catalog health"
      hint="Tracks the app cannot fully use, split by what SoundCloud last said. Re-resolve refetches the selected rows through the enrichment path with your token: a track that is playable again flips back, one that has vanished is marked gone."
      padded={false}
      action={
        <span className="font-mono text-[11px] text-muted-foreground">{q.isPending ? "Loading…" : `${fmtInt(total)} ${meta.label.toLowerCase()}`}</span>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 pb-3 sm:px-5">
        <Segmented
          label="Health state"
          value={state}
          onChange={onStateChange}
          options={STATES.map((s) => ({
            value: s.value,
            label: (
              <>
                {s.label} <span className="ml-1 text-muted-foreground">{fmtInt(counts[s.value])}</span>
              </>
            ),
            title: s.hint,
          }))}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SmallButton
            tone="primary"
            disabled={selected.size === 0 || reResolve.isPending}
            onClick={() => run([...selected])}
            title={`Refetch the selected tracks from SoundCloud (max ${RE_RESOLVE_CAP})`}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", reResolve.isPending && "animate-spin")} aria-hidden="true" />
            Re-resolve {selected.size > 0 ? fmtInt(Math.min(selected.size, RE_RESOLVE_CAP)) : "selected"}
          </SmallButton>
          <SmallButton disabled={pageIds.length === 0 || reResolve.isPending} onClick={() => run(pageIds)} title="Refetch every track on this page">
            This page
          </SmallButton>
        </div>
      </div>

      <div className="px-4 pt-3 sm:px-5">
        <p className="mb-3 text-[12px] text-muted-foreground">{meta.hint}</p>

        {reResolve.isError && (
          <ErrorNotice message={reResolve.error.message || "Re-resolve failed."} className="mb-3" />
        )}
        {lastResult && !reResolve.isPending && !reResolve.isError && (
          <div role="status" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/[0.06] px-3 py-2 font-mono text-[12px] text-foreground">
            <CheckCircle2 className="h-4 w-4 text-chart-3" aria-hidden="true" />
            Re-resolved {fmtInt(lastResult.requested)}: {fmtInt(lastResult.fetched)} came back from SoundCloud, {fmtInt(lastResult.missing)} did not.
            <span className="text-muted-foreground">{timeAgo(new Date(lastResult.at).toISOString())} · lists refresh automatically</span>
          </div>
        )}

        {q.isError ? (
          <ErrorNotice message="Could not load this health list." onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <RowSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <Empty className="mb-4">Nothing is {meta.label.toLowerCase()} right now.</Empty>
        ) : (
          <TableShell minWidth={720} className={cn(q.isPlaceholderData && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                <th scope="col" className={cn(thClass, "w-8")}>
                  <input
                    type="checkbox"
                    aria-label="Select every track on this page"
                    checked={allOnPage}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                  />
                </th>
                <th scope="col" className={thClass}>Track</th>
                <th scope="col" className={thClass}>Artist</th>
                <th scope="col" className={thClass}>State</th>
                <th scope="col" className={cn(thClass, "text-right")}>Attempts</th>
                <th scope="col" className={cn(thClass, "text-right")}>Touches</th>
                <th scope="col" className={thClass}>Last seen</th>
                <th scope="col" className={cn(thClass, "w-8")}>
                  <span className="sr-only">Play</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const id = String(t.id);
                const checked = selected.has(id);
                const isPlaying = playing === id;
                return (
                  <React.Fragment key={id}>
                  <tr className={cn("transition-colors hover:bg-primary/[0.05]", (checked || isPlaying) && "bg-primary/[0.06]")}>
                    <td className={cn(tdClass, "pr-0")}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${t.title || `track ${id}`}`}
                        checked={checked}
                        onChange={() => toggleOne(id)}
                        className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                      />
                    </td>
                    <td className={cn(tdClass, "max-w-[300px]")}>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className={cn("truncate", t.title ? "text-foreground" : "font-mono text-chart-4")}>{t.title || `#${id}`}</span>
                        {t.permalinkUrl && (
                          <a href={t.permalinkUrl} target="_blank" rel="noreferrer" aria-label="Open on SoundCloud" className="shrink-0 text-muted-foreground hover:text-primary">
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">#{id}</div>
                    </td>
                    <td className={cn(tdClass, "max-w-[180px] truncate text-foreground/80")}>{t.artistName || "—"}</td>
                    <td className={cn(tdClass, "font-mono text-[11px]")}>
                      <span className={meta.kind === "access" ? "text-destructive" : "text-chart-4"}>{meta.kind === "access" ? t.access : t.resolveStatus}</span>
                      {meta.kind === "access" && t.resolveStatus !== "resolved" && <span className="ml-1.5 text-chart-4">{t.resolveStatus}</span>}
                    </td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-muted-foreground")}>{fmtInt(t.resolveAttempts)}</td>
                    <td className={cn(tdClass, "text-right font-mono font-semibold tabular-nums text-primary")}>{fmtInt(t.touches)}</td>
                    <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(t.lastSeenAt)}>
                      {t.lastSeenAt ? timeAgo(t.lastSeenAt) : "—"}
                    </td>
                    <td className={cn(tdClass, "text-right")}>
                      {t.permalinkUrl && (
                        <button
                          type="button"
                          aria-pressed={isPlaying}
                          aria-label={isPlaying ? "Close player" : `Play ${t.title || `track ${id}`} here`}
                          onClick={() => setPlaying(isPlaying ? null : id)}
                          className={cn("inline-flex h-6 w-6 items-center justify-center rounded", isPlaying ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-primary")}
                        >
                          {isPlaying ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isPlaying && (
                    <tr className="bg-primary/[0.04]">
                      <td colSpan={8} className="px-4 pb-3 pt-1 sm:px-5">
                        <div className="max-w-[640px]">
                          <TrackPlayer permalinkUrl={t.permalinkUrl} title={t.title || `#${id}`} open onToggle={() => setPlaying(null)} />
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </TableShell>
        )}
        <Pager page={page} total={total} onPage={setPage} />
        {total > CATALOG_PAGE_SIZE && (
          <p className="pb-3 font-mono text-[11px] text-muted-foreground">
            Re-resolve works on what you select or on the current page, at most {RE_RESOLVE_CAP} tracks per click; the heavy-operation limiter allows 20 clicks an hour.
          </p>
        )}
      </div>
    </Panel>
  );
}
