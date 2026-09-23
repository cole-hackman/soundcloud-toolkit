"use client";

import * as React from "react";
import { TrendChart } from "../../charts";
import { fmtInt, periodLong } from "../../format";
import { BarList, ErrorNotice, Mini, Panel, RowSkeleton, Segmented, type Tone } from "../../primitives";
import { useCatalogDaily, useCatalogSummary } from "../../queries";
import { CATALOG_SUBVIEWS, DEFAULT_CATALOG_FILTER, type CatalogFilter, type CatalogSubView, type Period } from "../../types";
import { ArtistsTable } from "./ArtistsTable";
import { HealthPanel, type HealthState } from "./HealthPanel";
import { PlaylistsTable } from "./PlaylistsTable";
import { TracksTable, accessTone } from "./TracksTable";

type TouchMetric = "touches" | "distinctTracks" | "playlistTouches";
const METRICS: ReadonlyArray<{ value: TouchMetric; label: string; tone: Tone }> = [
  { value: "touches", label: "Track touches", tone: "primary" },
  { value: "distinctTracks", label: "Distinct tracks", tone: "info" },
  { value: "playlistTouches", label: "Playlist touches", tone: "ok" },
];

const HEALTH_STATES: ReadonlyArray<HealthState> = ["blocked", "preview", "gone", "pending", "not_found"];

function isSub(v: string): v is CatalogSubView {
  return CATALOG_SUBVIEWS.some((s) => s.id === v);
}

/** The sub-view rides in the hash as `#catalog/<sub>` so a health list can be linked. */
function readHashSub(): CatalogSubView {
  if (typeof window === "undefined") return "tracks";
  const [, sub] = window.location.hash.replace(/^#/, "").split("/");
  return sub && isSub(sub) ? sub : "tracks";
}

export function CatalogView({ period, enabled }: { period: Period; enabled: boolean }) {
  const [sub, setSubState] = React.useState<CatalogSubView>("tracks");
  const [tracksFilter, setTracksFilter] = React.useState<CatalogFilter>(DEFAULT_CATALOG_FILTER);
  const [healthState, setHealthState] = React.useState<HealthState>("blocked");
  const [metric, setMetric] = React.useState<TouchMetric>("touches");

  React.useEffect(() => {
    setSubState(readHashSub());
  }, []);

  const setSub = React.useCallback((next: CatalogSubView) => {
    setSubState(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#catalog/${next}`);
    }
  }, []);

  // A new period changes totals; never strand the user past the last page.
  React.useEffect(() => {
    setTracksFilter((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [period]);

  const summaryQ = useCatalogSummary(period, enabled);
  const dailyQ = useCatalogDaily(period, enabled);
  const summary = summaryQ.data;
  const metricMeta = METRICS.find((m) => m.value === metric) ?? METRICS[0];

  const accessCounts = summary?.accessBreakdown ?? {};
  const unresolved = Object.entries(summary?.resolveBreakdown ?? {})
    .filter(([k]) => k !== "resolved")
    .reduce((acc, [, v]) => acc + v, 0);
  const notPlayable = (accessCounts.blocked ?? 0) + (accessCounts.preview ?? 0) + (accessCounts.gone ?? 0);

  const openTracksWith = (patch: Partial<CatalogFilter>) => {
    setTracksFilter({ ...DEFAULT_CATALOG_FILTER, ...patch });
    setSub("tracks");
  };
  const openHealth = (state: HealthState) => {
    setHealthState(state);
    setSub("health");
  };

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
          <div className="grid grid-cols-3 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <Mini label="Tracks" value={fmtInt(summary.totalTracks)} />
            <Mini label="Artists" value={fmtInt(summary.totalArtists)} tone="info" />
            <Mini label="Playlists" value={fmtInt(summary.totalPlaylists)} />
            <Mini label="Touches" value={fmtInt(summary.periodTouchEvents)} tone="primary" />
            <Mini label="Distinct touched" value={fmtInt(summary.periodDistinctTracks)} tone="info" />
            <button type="button" onClick={() => openHealth("pending")} className="rounded-md text-left hover:bg-accent/40" title="Open the pending list">
              <Mini label="Unresolved" value={fmtInt(unresolved)} tone={unresolved > 0 ? "warn" : "muted"} />
            </button>
            <button type="button" onClick={() => openHealth("blocked")} className="rounded-md text-left hover:bg-accent/40" title="Open the health view">
              <Mini label="Not playable" value={fmtInt(notPlayable)} tone={notPlayable > 0 ? "danger" : "muted"} />
            </button>
          </div>
        ) : null}
      </Panel>

      <Panel
        index={1}
        title="Catalog activity"
        hint={`Per day, ${periodLong(period)}. A touch is one track id inside one operation's metadata.`}
        action={<Segmented size="sm" label="Metric" options={METRICS} value={metric} onChange={setMetric} />}
      >
        {dailyQ.isPending ? (
          <RowSkeleton rows={1} height="h-[160px]" />
        ) : dailyQ.isError ? (
          <ErrorNotice message="Could not load the catalog series." onRetry={() => dailyQ.refetch()} />
        ) : (
          <TrendChart data={dailyQ.data ?? []} metric={metric} label={metricMeta.label} tone={metricMeta.tone} height={160} />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel index={2} title="Genres" hint="Top 12 normalized genres, missing included. Click to filter the tracks.">
          {summaryQ.isPending ? (
            <RowSkeleton rows={6} height="h-5" />
          ) : (
            <BarList
              tone="info"
              items={(summary?.genreBreakdown ?? []).map((g) => ({
                key: g.genre,
                label: g.genre === "(none)" ? <span className="text-warning-text">(no genre)</span> : g.genre,
                value: g.count,
                tone: g.genre === "(none)" ? ("warn" as Tone) : ("info" as Tone),
                onClick: () => openTracksWith({ genre: g.genre }),
                title: `Show ${g.genre} tracks`,
              }))}
            />
          )}
        </Panel>
        <Panel index={3} title="Access status" hint="What SoundCloud reports for each track. Click a problem state to open the health list.">
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
                  onClick: () => (HEALTH_STATES.includes(k as HealthState) ? openHealth(k as HealthState) : openTracksWith({ access: k })),
                  title: HEALTH_STATES.includes(k as HealthState) ? `Open the ${k} list` : `Show ${k} tracks`,
                }))}
            />
          )}
        </Panel>
      </div>

      <nav aria-label="Catalog sections" className="admin-reveal -mb-2 flex gap-1 overflow-x-auto border-b border-border/60" style={{ ["--i" as string]: 4 }}>
        {CATALOG_SUBVIEWS.map((s) => {
          const active = s.id === sub;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSub(s.id)}
              className={
                active
                  ? "relative shrink-0 px-3 pb-2 pt-1 font-mono text-[12px] font-medium text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-primary"
                  : "shrink-0 px-3 pb-2 pt-1 font-mono text-[12px] font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <div key={sub}>
        {sub === "tracks" && <TracksTable period={period} enabled={enabled} summary={summary} filter={tracksFilter} onFilterChange={setTracksFilter} />}
        {sub === "playlists" && <PlaylistsTable period={period} enabled={enabled} />}
        {sub === "artists" && <ArtistsTable period={period} enabled={enabled} onOpenArtist={(name) => openTracksWith({ artist: name })} />}
        {sub === "health" && <HealthPanel period={period} enabled={enabled} summary={summary} state={healthState} onStateChange={setHealthState} />}
      </div>
    </div>
  );
}
