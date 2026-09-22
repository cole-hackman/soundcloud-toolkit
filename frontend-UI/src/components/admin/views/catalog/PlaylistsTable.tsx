"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fmtAbsolute, fmtInt, timeAgo } from "../../format";
import { Empty, ErrorNotice, Panel, RowSkeleton, SortTh, TableShell, tdClass, thClass } from "../../primitives";
import { catalogCsvUrl, catalogPlaylistsParams, useCatalogPlaylists } from "../../queries";
import { DEFAULT_PLAYLIST_FILTER, type Period, type PlaylistFilter, type PlaylistSort } from "../../types";
import { ColumnToggles, ExportLink, Pager, SearchBox, useToggleSet } from "./shared";

type OptionalCol = "firstSeen" | "lastSeen";
const OPTIONAL_COLS: ReadonlyArray<{ key: OptionalCol; label: string }> = [
  { key: "firstSeen", label: "First seen" },
  { key: "lastSeen", label: "Last seen" },
];

export function PlaylistsTable({ period, enabled }: { period: Period; enabled: boolean }) {
  const [filter, setFilter] = React.useState<PlaylistFilter>(DEFAULT_PLAYLIST_FILTER);
  const [qInput, setQInput] = React.useState("");
  const debouncedQ = useDebouncedValue(qInput.trim(), 350);
  React.useEffect(() => {
    setFilter((f) => (f.q === debouncedQ ? f : { ...f, q: debouncedQ, page: 1 }));
  }, [debouncedQ]);
  React.useEffect(() => {
    setFilter((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [period]);

  const [cols, toggleCol] = useToggleSet<OptionalCol>();
  const q = useCatalogPlaylists(period, filter, enabled);
  const rows = q.data?.playlists ?? [];
  const total = q.data?.total ?? 0;

  const toggleSort = (key: PlaylistSort) =>
    setFilter((f) => ({
      ...f,
      sort: key,
      order: f.sort === key ? (f.order === "desc" ? "asc" : "desc") : key === "title" ? "asc" : "desc",
      page: 1,
    }));

  return (
    <Panel
      index={4}
      title="Playlists"
      hint="Every playlist the app has seen. Touches count the operations that named the playlist in the window; the owner is a SoundCloud user id."
      padded={false}
      action={
        <>
          <span className="font-mono text-[11px] text-muted-foreground">{q.isPending ? "Loading…" : `${fmtInt(total)} playlists`}</span>
          <ExportLink href={catalogCsvUrl("playlists", catalogPlaylistsParams(period, filter))} />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 pb-3 sm:px-5">
        <SearchBox value={qInput} onChange={setQInput} placeholder="Title contains…" label="Title" className="relative flex-1 basis-56" />
        <div className="ml-auto">
          <ColumnToggles columns={OPTIONAL_COLS} visible={cols} onToggle={toggleCol} />
        </div>
      </div>

      <div className="px-4 pt-3 sm:px-5">
        {q.isError ? (
          <ErrorNotice message="Could not load catalog playlists." onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <RowSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <Empty className="mb-4">No playlists match. The catalog fills as operations run.</Empty>
        ) : (
          <TableShell minWidth={720 + cols.size * 110} className={cn(q.isPlaceholderData && "opacity-60 transition-opacity")}>
            <thead>
              <tr>
                <SortTh label="Playlist" active={filter.sort === "title"} order={filter.order} onClick={() => toggleSort("title")} />
                <th scope="col" className={thClass}>Owner</th>
                <SortTh label="Tracks" active={filter.sort === "trackCount"} order={filter.order} onClick={() => toggleSort("trackCount")} align="right" />
                <SortTh label="Touches" active={filter.sort === "touches"} order={filter.order} onClick={() => toggleSort("touches")} align="right" />
                <SortTh label="Users" active={filter.sort === "users"} order={filter.order} onClick={() => toggleSort("users")} align="right" />
                <SortTh label="Last touched" active={filter.sort === "lastTouched"} order={filter.order} onClick={() => toggleSort("lastTouched")} />
                {cols.has("firstSeen") && <SortTh label="First seen" active={filter.sort === "firstSeen"} order={filter.order} onClick={() => toggleSort("firstSeen")} />}
                {cols.has("lastSeen") && <SortTh label="Last seen" active={filter.sort === "lastSeen"} order={filter.order} onClick={() => toggleSort("lastSeen")} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const id = String(p.id);
                return (
                  <tr key={id} className="transition-colors hover:bg-primary/[0.05]">
                    <td className={cn(tdClass, "max-w-[320px]")}>
                      <div className={cn("truncate", p.title ? "text-foreground" : "font-mono text-chart-4")}>{p.title || `#${id} (untitled)`}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">#{id}</div>
                    </td>
                    <td className={cn(tdClass, "font-mono text-[11px] text-muted-foreground")}>{p.ownerScId != null ? String(p.ownerScId) : "—"}</td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-foreground/80")}>{p.trackCount != null ? fmtInt(p.trackCount) : "—"}</td>
                    <td className={cn(tdClass, "text-right font-mono font-semibold tabular-nums text-primary")}>{fmtInt(p.touches)}</td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-foreground/80")}>{fmtInt(p.users)}</td>
                    <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(p.last_touched)}>
                      {p.last_touched ? timeAgo(p.last_touched) : "—"}
                    </td>
                    {cols.has("firstSeen") && (
                      <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(p.firstSeenAt)}>
                        {p.firstSeenAt ? timeAgo(p.firstSeenAt) : "—"}
                      </td>
                    )}
                    {cols.has("lastSeen") && (
                      <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(p.lastSeenAt)}>
                        {p.lastSeenAt ? timeAgo(p.lastSeenAt) : "—"}
                      </td>
                    )}
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
