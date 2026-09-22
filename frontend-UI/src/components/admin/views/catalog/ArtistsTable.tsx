"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fmtAbsolute, fmtInt, timeAgo } from "../../format";
import { Empty, ErrorNotice, Panel, RowSkeleton, SortTh, TableShell, TONE_BG, tdClass, thClass, type Tone } from "../../primitives";
import { catalogArtistsParams, catalogCsvUrl, useCatalogArtists } from "../../queries";
import { DEFAULT_ARTIST_FILTER, type ArtistFilter, type ArtistSort, type Period } from "../../types";
import { ExportLink, Pager, SearchBox } from "./shared";

function shareTone(pct: number): Tone {
  if (pct >= 50) return "danger";
  if (pct >= 10) return "warn";
  return "ok";
}

interface Props {
  period: Period;
  enabled: boolean;
  onOpenArtist: (artistName: string) => void;
}

export function ArtistsTable({ period, enabled, onOpenArtist }: Props) {
  const [filter, setFilter] = React.useState<ArtistFilter>(DEFAULT_ARTIST_FILTER);
  const [qInput, setQInput] = React.useState("");
  const debouncedQ = useDebouncedValue(qInput.trim(), 350);
  React.useEffect(() => {
    setFilter((f) => (f.q === debouncedQ ? f : { ...f, q: debouncedQ, page: 1 }));
  }, [debouncedQ]);
  React.useEffect(() => {
    setFilter((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [period]);

  const q = useCatalogArtists(period, filter, enabled);
  const rows = q.data?.artists ?? [];
  const total = q.data?.total ?? 0;

  const toggleSort = (key: ArtistSort) =>
    setFilter((f) => ({
      ...f,
      sort: key,
      order: f.sort === key ? (f.order === "desc" ? "asc" : "desc") : key === "name" ? "asc" : "desc",
      page: 1,
    }));

  return (
    <Panel
      index={4}
      title="Artists"
      hint="The catalog rolled up by artist. Sort by “not playable” to find a whole discography that has gone dark. Click a name to open its tracks."
      padded={false}
      action={
        <>
          <span className="font-mono text-[11px] text-muted-foreground">{q.isPending ? "Loading…" : `${fmtInt(total)} artists`}</span>
          <ExportLink href={catalogCsvUrl("artists", catalogArtistsParams(period, filter))} />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 pb-3 sm:px-5">
        <SearchBox value={qInput} onChange={setQInput} placeholder="Artist contains…" label="Artist" className="relative flex-1 basis-56" />
      </div>

      <div className="px-4 pt-3 sm:px-5">
        {q.isError ? (
          <ErrorNotice message="Could not load the artist roll-up." onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <RowSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <Empty className="mb-4">No artists match.</Empty>
        ) : (
          <TableShell minWidth={760} className={cn(q.isPlaceholderData && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                <SortTh label="Artist" active={filter.sort === "name"} order={filter.order} onClick={() => toggleSort("name")} />
                <SortTh label="Tracks" active={filter.sort === "tracks"} order={filter.order} onClick={() => toggleSort("tracks")} align="right" />
                <SortTh label="Touches" active={filter.sort === "touches"} order={filter.order} onClick={() => toggleSort("touches")} align="right" />
                <SortTh label="Not playable" active={filter.sort === "notPlayable"} order={filter.order} onClick={() => toggleSort("notPlayable")} className="w-[30%]" />
                <SortTh label="Unresolved" active={filter.sort === "unresolved"} order={filter.order} onClick={() => toggleSort("unresolved")} align="right" />
                <SortTh label="Last touched" active={filter.sort === "lastTouched"} order={filter.order} onClick={() => toggleSort("lastTouched")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const pct = Number(a.notPlayablePct) || 0;
                const tone = shareTone(pct);
                return (
                  <tr key={a.artist_key} className="transition-colors hover:bg-primary/[0.05]">
                    <td className={cn(tdClass, "max-w-[260px]")}>
                      {a.artistName ? (
                        <button
                          type="button"
                          onClick={() => onOpenArtist(a.artistName ?? "")}
                          className="truncate text-left text-foreground hover:text-primary hover:underline"
                          title="Open this artist's tracks"
                        >
                          {a.artistName}
                        </button>
                      ) : (
                        <span className="font-mono text-muted-foreground">artist #{String(a.artistId ?? a.artist_key)}</span>
                      )}
                      {a.artistId != null && <div className="font-mono text-[10px] text-muted-foreground">#{String(a.artistId)}</div>}
                    </td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-foreground/80")}>{fmtInt(a.tracks)}</td>
                    <td className={cn(tdClass, "text-right font-mono font-semibold tabular-nums text-primary")}>{fmtInt(a.touches)}</td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <span className="relative h-[14px] min-w-0 flex-1 overflow-hidden rounded-[3px] bg-muted/60">
                          <span className={cn("absolute inset-y-0 left-0 rounded-[3px] opacity-80", TONE_BG[tone])} style={{ width: `${Math.min(Math.max(pct, pct > 0 ? 1.5 : 0), 100)}%` }} />
                        </span>
                        <span className="w-[88px] shrink-0 text-right font-mono text-[11px] tabular-nums">
                          <span className={cn("font-semibold", pct > 0 ? "text-foreground" : "text-muted-foreground")}>{pct.toFixed(pct >= 10 ? 0 : 1)}%</span>
                          <span className="ml-1 text-muted-foreground">({fmtInt(a.notPlayable)})</span>
                        </span>
                      </div>
                    </td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums", a.unresolved > 0 ? "text-chart-4" : "text-muted-foreground")}>{fmtInt(a.unresolved)}</td>
                    <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(a.last_touched)}>
                      {a.last_touched ? timeAgo(a.last_touched) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
        <Pager page={filter.page} total={total} onPage={(page) => setFilter((f) => ({ ...f, page }))} />
      </div>
    </Panel>
  );
}
