"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtAbsolute, fmtInt, fmtMs, periodLong, timeAgo } from "../format";
import { BarList, Empty, ErrorNotice, Panel, RowSkeleton, Stat, TableShell, TONE_BG, tdClass, thClass, type Tone } from "../primitives";
import { useAdminStats } from "../queries";
import type { Period } from "../types";

interface Props {
  period: Period;
  enabled: boolean;
  onInspectAction: (action: string) => void;
}

function latencyTone(ms: number): Tone {
  if (ms >= 20_000) return "danger";
  if (ms >= 8_000) return "warn";
  return "ok";
}

export function PerformanceView({ period, enabled, onInspectAction }: Props) {
  const statsQ = useAdminStats(period, enabled);
  const stats = statsQ.data;
  const loading = statsQ.isPending;

  const latency = stats?.readLatency ?? [];
  const maxP95 = Math.max(...latency.map((r) => r.p95Ms), 1);
  const wh = stats?.analyticsWriteHealth;

  const byAvg = (stats?.featureUsage ?? [])
    .filter((f) => f.avgDurationMs > 0)
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-4">
      {statsQ.isError && <ErrorNotice message={statsQ.error.message || "Could not load stats."} onRetry={() => statsQ.refetch()} />}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat index={0} label="Avg latency" value={fmtMs(stats?.avgDurationMs)} loading={loading} tone="info" sub={`server time per operation · ${periodLong(period)}`} />
        <Stat
          index={1}
          label="p95 latency"
          value={fmtMs(stats?.p95DurationMs)}
          loading={loading}
          tone={stats ? latencyTone(stats.p95DurationMs) : "ok"}
          sub="the slowest 1 in 20 operations"
        />
        <Stat index={2} label="Tracks / op" value={fmtInt(stats?.avgTracksPerOp)} loading={loading} tone="primary" sub="average payload size" />
        <Stat
          index={3}
          label="Auto-splits"
          value={fmtInt(stats?.splitsCount)}
          loading={loading}
          tone="warn"
          sub={stats ? `${stats.splitRate}% of ${fmtInt(stats.operationsCount)} ops crossed 500 tracks` : null}
        />
      </div>

      <Panel
        index={4}
        title="Slowest actions by p95"
        hint="Includes the read:* latency probes. Only actions with three or more runs; SC calls is the average SoundCloud round-trips per run — the number that usually explains a slow p95."
        padded={false}
        footer={`${latency.length} actions ranked. Click one to open its operations.`}
      >
        {loading ? (
          <div className="px-4 pb-4 sm:px-5">
            <RowSkeleton rows={8} />
          </div>
        ) : latency.length === 0 ? (
          <div className="px-4 pb-4 sm:px-5">
            <Empty>No action has three timed runs in this window yet.</Empty>
          </div>
        ) : (
          <TableShell minWidth={720} className="mx-0 sm:mx-0">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Action</th>
                <th scope="col" className={cn(thClass, "text-right")}>Runs</th>
                <th scope="col" className={cn(thClass, "text-right")}>Avg</th>
                <th scope="col" className={cn(thClass, "w-[38%]")}>p95</th>
                <th scope="col" className={cn(thClass, "text-right")}>Max</th>
                <th scope="col" className={cn(thClass, "text-right")}>SC calls</th>
              </tr>
            </thead>
            <tbody>
              {latency.map((row) => {
                const tone = latencyTone(row.p95Ms);
                const isProbe = row.action.startsWith("read:");
                return (
                  <tr key={row.action} className="hover:bg-primary/[0.05]">
                    <td className={cn(tdClass, "max-w-[240px]")}>
                      {isProbe ? (
                        <span className="text-foreground/90" title={row.action}>
                          <span className="mr-1.5 rounded bg-muted px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground">read</span>
                          {row.name}
                        </span>
                      ) : (
                        <button type="button" onClick={() => onInspectAction(row.action)} className="truncate text-left text-foreground/90 hover:text-primary-text hover:underline" title={`Inspect ${row.name} operations`}>
                          {row.name}
                        </button>
                      )}
                    </td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-muted-foreground")}>{fmtInt(row.runs)}</td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums")}>{fmtMs(row.avgMs)}</td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <span className="relative h-[14px] min-w-0 flex-1 overflow-hidden rounded-[3px] bg-muted/60">
                          <span className={cn("absolute inset-y-0 left-0 rounded-[3px] opacity-80", TONE_BG[tone])} style={{ width: `${Math.max((row.p95Ms / maxP95) * 100, 1)}%` }} />
                        </span>
                        <span className="w-16 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums">{fmtMs(row.p95Ms)}</span>
                      </div>
                    </td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-muted-foreground")}>{fmtMs(row.maxMs)}</td>
                    <td className={cn(tdClass, "text-right font-mono tabular-nums text-muted-foreground")}>{row.avgScCalls == null ? "—" : row.avgScCalls.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel index={5} title="Average duration by feature" hint="User-facing operations only, slowest first.">
          {loading ? (
            <RowSkeleton rows={6} height="h-5" />
          ) : (
            <BarList
              tone="info"
              items={byAvg.map((f) => ({
                key: f.key,
                label: f.name,
                value: f.avgDurationMs,
                display: fmtMs(f.avgDurationMs),
                sub: `${fmtInt(f.count)} runs`,
                tone: latencyTone(f.avgDurationMs) === "ok" ? "info" : latencyTone(f.avgDurationMs),
                onClick: () => onInspectAction(f.key),
              }))}
              emptyText="No timed operations in this window."
            />
          )}
        </Panel>

        <Panel index={6} title="Analytics write health" hint="Whether operation logs are reaching Postgres. Counters reset when the server restarts.">
          {loading ? (
            <RowSkeleton rows={3} />
          ) : !wh ? (
            <Empty>Not reported.</Empty>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Write failures</dt>
                <dd className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", wh.failures > 0 ? "text-destructive-text" : "text-success-text")}>{fmtInt(wh.failures)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Last write</dt>
                <dd className="mt-1 font-mono text-[12px] text-foreground" title={fmtAbsolute(wh.lastWriteAt)}>
                  {wh.lastWriteAt ? timeAgo(wh.lastWriteAt) : "none since start"}
                </dd>
              </div>
              {wh.failures > 0 && (
                <div className="col-span-2 rounded-lg border border-destructive/40 bg-destructive/[0.08] p-3">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-destructive-text">Last failure · {wh.lastFailureAt ? timeAgo(wh.lastFailureAt) : "—"}</dt>
                  <dd className="mt-1 break-words font-mono text-[12px] text-foreground">{wh.lastFailureMessage || "No message captured."}</dd>
                </div>
              )}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
