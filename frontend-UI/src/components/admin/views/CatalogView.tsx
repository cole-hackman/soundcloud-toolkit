"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fmtAbsolute, fmtInt, periodLong, timeAgo } from "../format";
import {
  BarList,
  Empty,
  ErrorNotice,
  Mini,
  Panel,
  RowSkeleton,
  Select,
  SmallButton,
  SortTh,
  StatusPill,
  TableShell,
  TextField,
  tdClass,
  thClass,
  type Tone,
} from "../primitives";
import { CATALOG_PAGE_SIZE, useCatalogSummary, useCatalogTracks, useTrackOperations } from "../queries";
import { DEFAULT_CATALOG_FILTER, type CatalogFilter, type CatalogSort, type Period } from "../types";

interface Props {
  period: Period;
  enabled: boolean;
}

// Actions that carry trackIds in their metadata, so "touched by" is meaningful.
const TRACK_ACTIONS = [
  "merge", "from-likes", "bulk-unlike", "bulk-like", "clone", "genre-search",
  "library-audit", "playlist-compare", "resolve", "batch-resolve",
  "bulk-remove-reposts", "proxy-download",
];
const ACCESS_STATES = ["playable", "preview", "blocked", "gone", "unknown"];
const RESOLVE_STATES = ["resolved", "pending", "not_found", "gone"];

function accessTone(access: string | null): Tone {
  if (!access) return "muted";
  return access === "playable" ? "ok" : "danger";
}

function TrackOpsRow({ trackId, colSpan }: { trackId: string; colSpan: number }) {
  const q = useTrackOperations(trackId);
  return (
    <tr className="bg-primary/[0.04]">
      <td colSpan={colSpan} className="px-4 pb-3 pt-1 sm:px-5">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Operations touching this track · latest 50</div>
        {q.isPending ? (
          <RowSkeleton rows={2} height="h-5" />
        ) : q.isError ? (
          <ErrorNotice message="Could not load this track's operations." onRetry={() => q.refetch()} />
        ) : q.data.length === 0 ? (
          <p className="font-mono text-[11px] text-muted-foreground">No logged operation references this track.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {q.data.map((op) => (
              <li key={op.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[12px]">
                <span className="font-mono font-medium text-primary">@{op.user.username}</span>
                <span className="text-foreground/90">{op.actionName}</span>
                <StatusPill status={op.status} />
                <span className="font-mono text-[11px] text-muted-foreground" title={fmtAbsolute(op.createdAt)}>{timeAgo(op.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

export function CatalogView({ period, enabled }: Props) {
  const [filter, setFilter] = React.useState<CatalogFilter>(DEFAULT_CATALOG_FILTER);
  const [artistInput, setArtistInput] = React.useState("");
  const debouncedArtist = useDebouncedValue(artistInput.trim(), 350);
  React.useEffect(() => {
    setFilter((f) => (f.artist === debouncedArtist ? f : { ...f, artist: debouncedArtist, page: 1 }));
  }, [debouncedArtist]);
  // A new period changes totals; never strand the user past the last page.
  React.useEffect(() => {
    setFilter((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [period]);

  const [expanded, setExpanded] = React.useState<string | null>(null);

  const summaryQ = useCatalogSummary(period, enabled);
  const tracksQ = useCatalogTracks(period, filter, enabled);
  const summary = summaryQ.data;
  const tracks = tracksQ.data?.tracks ?? [];
  const total = tracksQ.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / CATALOG_PAGE_SIZE), 1);

  const set = (patch: Partial<CatalogFilter>) => setFilter((f) => ({ ...f, ...patch, page: 1 }));
  const toggleSort = (key: CatalogSort) =>
    setFilter((f) => ({
      ...f,
      sort: key,
      order: f.sort === key ? (f.order === "desc" ? "asc" : "desc") : key === "title" || key === "artist" ? "asc" : "desc",
      page: 1,
    }));

  const accessCounts = summary?.accessBreakdown ?? {};
  const unresolved = Object.entries(summary?.resolveBreakdown ?? {})
    .filter(([k]) => k !== "resolved")
    .reduce((acc, [, v]) => acc + v, 0);
  const notPlayable = (accessCounts.blocked ?? 0) + (accessCounts.preview ?? 0) + (accessCounts.gone ?? 0);
  const activeFilters = [filter.genre, filter.artist, filter.access, filter.resolveStatus, filter.action].filter(Boolean).length;

  const COLS = 8;

  return (
    <div className="flex flex-col gap-4">
      {summaryQ.isError && <ErrorNotice message="Could not load the catalog summary." onRetry={() => summaryQ.refetch()} />}

      <Panel
        index={0}
        title="Catalog at a glance"
        hint={`Totals are all-time; touches count track ids in operation metadata over the ${periodLong(period)}. Gaps — unresolved rows and missing genres — are shown, not hidden.`}
      >
        {summaryQ.isPending ? (
          <RowSkeleton rows={2} />
        ) : summary ? (
          <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            <Mini label="Tracks" value={fmtInt(summary.totalTracks)} />
            <Mini label="Artists" value={fmtInt(summary.totalArtists)} tone="info" />
            <Mini label="Playlists" value={fmtInt(summary.totalPlaylists)} />
            <Mini label="Touches" value={fmtInt(summary.periodTouchEvents)} tone="primary" />
            <Mini label="Unresolved" value={fmtInt(unresolved)} tone={unresolved > 0 ? "warn" : "muted"} />
            <Mini label="Not playable" value={fmtInt(notPlayable)} tone={notPlayable > 0 ? "danger" : "muted"} />
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel index={1} title="Genres" hint="Top 12 normalized genres, missing included.">
          {summaryQ.isPending ? (
            <RowSkeleton rows={6} height="h-5" />
          ) : (
            <BarList
              tone="info"
              items={(summary?.genreBreakdown ?? []).map((g) => ({
                key: g.genre,
                label: g.genre === "(none)" ? <span className="text-chart-4">(no genre)</span> : g.genre,
                value: g.count,
                tone: g.genre === "(none)" ? ("warn" as Tone) : ("info" as Tone),
                onClick: () => set({ genre: g.genre }),
                title: `Filter the table to ${g.genre}`,
              }))}
            />
          )}
        </Panel>
        <Panel index={2} title="Access status" hint="What SoundCloud reports for each track. Click to filter.">
          {summaryQ.isPending ? (
            <RowSkeleton rows={4} height="h-5" />
          ) : (
            <BarList
              items={Object.entries(accessCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({
                  key: k,
                  label: k,
                  value: v,
                  tone: accessTone(k === "unknown" ? null : k),
                  onClick: () => set({ access: k }),
                  title: `Filter the table to ${k}`,
                }))}
            />
          )}
        </Panel>
      </div>

      <Panel
        index={3}
        title="Tracks"
        hint="Aggregate by default — who touched a track only shows when you expand it."
        padded={false}
        action={<span className="font-mono text-[11px] text-muted-foreground">{tracksQ.isPending ? "Loading…" : `${fmtInt(total)} tracks`}</span>}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 pb-3 sm:px-5">
          <label>
            <span className="sr-only">Genre</span>
            <Select value={filter.genre} onChange={(e) => set({ genre: e.target.value })}>
              <option value="">All genres</option>
              {(summary?.genreBreakdown ?? []).map((g) => (
                <option key={g.genre} value={g.genre}>{g.genre}</option>
              ))}
              {filter.genre && !(summary?.genreBreakdown ?? []).some((g) => g.genre === filter.genre) && <option value={filter.genre}>{filter.genre}</option>}
            </Select>
          </label>
          <label>
            <span className="sr-only">Access</span>
            <Select value={filter.access} onChange={(e) => set({ access: e.target.value })}>
              <option value="">All access</option>
              {ACCESS_STATES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Resolve state</span>
            <Select value={filter.resolveStatus} onChange={(e) => set({ resolveStatus: e.target.value })}>
              <option value="">All resolve states</option>
              {RESOLVE_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Touched by action</span>
            <Select value={filter.action} onChange={(e) => set({ action: e.target.value })}>
              <option value="">Touched by any action</option>
              {TRACK_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </label>
          <label className="flex-1 basis-40">
            <span className="sr-only">Artist</span>
            <TextField value={artistInput} onChange={(e) => setArtistInput(e.target.value)} placeholder="Artist contains…" className="w-full" />
          </label>
          {activeFilters > 0 && (
            <SmallButton
              className="h-7"
              onClick={() => {
                setArtistInput("");
                setFilter({ ...DEFAULT_CATALOG_FILTER, sort: filter.sort, order: filter.order });
              }}
            >
              <X className="h-3 w-3" aria-hidden="true" /> Clear {activeFilters}
            </SmallButton>
          )}
        </div>

        <div className="px-4 pt-3 sm:px-5">
          {tracksQ.isError ? (
            <ErrorNotice message="Could not load catalog tracks." onRetry={() => tracksQ.refetch()} />
          ) : tracksQ.isPending ? (
            <RowSkeleton rows={8} />
          ) : tracks.length === 0 ? (
            <Empty className="mb-4">No catalog tracks match these filters. The catalog fills as operations run.</Empty>
          ) : (
            <TableShell minWidth={860} className={cn(tracksQ.isPlaceholderData && "opacity-60 transition-opacity")}>
              <thead>
                <tr>
                  <th scope="col" className={cn(thClass, "w-8")}>
                    <span className="sr-only">Expand</span>
                  </th>
                  <SortTh label="Track" active={filter.sort === "title"} order={filter.order} onClick={() => toggleSort("title")} />
                  <SortTh label="Artist" active={filter.sort === "artist"} order={filter.order} onClick={() => toggleSort("artist")} />
                  <th scope="col" className={thClass}>Genre</th>
                  <th scope="col" className={thClass}>Access</th>
                  <SortTh label="Touches" active={filter.sort === "touches"} order={filter.order} onClick={() => toggleSort("touches")} align="right" />
                  <SortTh label="Users" active={filter.sort === "users"} order={filter.order} onClick={() => toggleSort("users")} align="right" />
                  <SortTh label="Last touched" active={filter.sort === "lastTouched"} order={filter.order} onClick={() => toggleSort("lastTouched")} />
                </tr>
              </thead>
              <tbody>
                {tracks.map((t) => {
                  const id = String(t.id);
                  const open = expanded === id;
                  return (
                    <React.Fragment key={id}>
                      <tr
                        onClick={() => setExpanded(open ? null : id)}
                        className={cn("cursor-pointer transition-colors hover:bg-primary/[0.06]", open && "bg-primary/[0.06]")}
                      >
                        <td className={cn(tdClass, "pr-0")}>
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={open ? "Collapse" : "Show operations for this track"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(open ? null : id);
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                          >
                            {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        </td>
                        <td className={cn(tdClass, "max-w-[280px]")}>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className={cn("truncate", t.title ? "text-foreground" : "font-mono text-chart-4")}>{t.title || `#${id} (unresolved)`}</span>
                            {t.permalinkUrl && (
                              <a
                                href={t.permalinkUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Open on SoundCloud"
                                className="shrink-0 text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                          {t.resolveStatus !== "resolved" && <span className="font-mono text-[10px] text-chart-4">{t.resolveStatus}</span>}
                        </td>
                        <td className={cn(tdClass, "max-w-[180px] truncate text-foreground/80")}>{t.artistName || "—"}</td>
                        <td className={cn(tdClass, "font-mono text-[11px]", t.genreNormalized ? "text-muted-foreground" : "text-chart-4")}>{t.genreNormalized || "(none)"}</td>
                        <td className={cn(tdClass, "font-mono text-[11px]")}>
                          <span className={cn("inline-flex items-center gap-1.5", accessTone(t.access) === "ok" ? "text-chart-3" : accessTone(t.access) === "danger" ? "text-destructive" : "text-muted-foreground")}>
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                            {t.access || "unknown"}
                          </span>
                        </td>
                        <td className={cn(tdClass, "text-right font-mono font-semibold tabular-nums text-primary")}>{fmtInt(t.touches)}</td>
                        <td className={cn(tdClass, "text-right font-mono tabular-nums text-foreground/80")}>{fmtInt(t.users)}</td>
                        <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(t.last_touched)}>
                          {t.last_touched ? timeAgo(t.last_touched) : "—"}
                        </td>
                      </tr>
                      {open && <TrackOpsRow trackId={id} colSpan={COLS} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </TableShell>
          )}

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-mono text-[11px] text-muted-foreground">
                Page {filter.page} of {fmtInt(totalPages)} · {CATALOG_PAGE_SIZE} per page
              </span>
              <div className="flex gap-1.5">
                <SmallButton className="h-7" disabled={filter.page <= 1} onClick={() => setFilter((f) => ({ ...f, page: Math.max(f.page - 1, 1) }))}>
                  ← Prev
                </SmallButton>
                <SmallButton className="h-7" disabled={filter.page >= totalPages} onClick={() => setFilter((f) => ({ ...f, page: Math.min(f.page + 1, totalPages) }))}>
                  Next →
                </SmallButton>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
