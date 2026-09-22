"use client";

import * as React from "react";
import { Activity, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { OutcomeBar, Sparkline, TrendChart, type TrendMetric } from "../charts";
import { fmtInt, fmtMs, fmtPct, periodLong, periodSentence } from "../format";
import { BarList, Empty, ErrorNotice, Mini, Panel, RowSkeleton, Segmented, Stat, TONE_SOFT, type Tone } from "../primitives";
import { useAdminDaily, useAdminStats } from "../queries";
import type { AdminStats, Period } from "../types";

interface Props {
  period: Period;
  enabled: boolean;
  onInspectErrorCode: (code: string) => void;
  onInspectAction: (action: string) => void;
}

/* ── Alert rules — the one line an operator reads first ─────────────── */

interface Alert {
  tone: Tone;
  text: string;
}

export function deriveAlerts(stats: AdminStats | undefined, period: Period): Alert[] {
  if (!stats) return [];
  const alerts: Alert[] = [];
  const wh = stats.analyticsWriteHealth;
  if (wh && wh.failures > 0) {
    alerts.push({
      tone: "danger",
      text: `${fmtInt(wh.failures)} operation-log write failure${wh.failures === 1 ? "" : "s"} since server start — analytics rows are being dropped${wh.lastFailureMessage ? ` (last: ${wh.lastFailureMessage})` : ""}.`,
    });
  }
  if (stats.operationsCount >= 10 && stats.errorRate >= 10) {
    alerts.push({ tone: "danger", text: `Error rate is ${stats.errorRate}% over the ${periodLong(period)}.` });
  } else if (stats.operationsCount >= 10 && stats.errorRate >= 5) {
    alerts.push({ tone: "warn", text: `Error rate is ${stats.errorRate}% over the ${periodLong(period)}.` });
  }
  if (stats.p95DurationMs >= 20_000) {
    alerts.push({ tone: "warn", text: `p95 latency is ${fmtMs(stats.p95DurationMs)} — check the Performance tab.` });
  }
  const worst = stats.errorRateByAction?.[0];
  if (worst && worst.count >= 5 && worst.errorRate >= 25) {
    alerts.push({ tone: "warn", text: `${worst.name} fails ${worst.errorRate}% of the time (${worst.errorCount}/${worst.count}).` });
  }
  return alerts;
}

function PulseStrip({ stats, period, loading }: { stats?: AdminStats; period: Period; loading: boolean }) {
  const alerts = deriveAlerts(stats, period);
  const worst: Tone = alerts.some((a) => a.tone === "danger") ? "danger" : alerts.length ? "warn" : "ok";
  const Icon = worst === "ok" ? CheckCircle2 : ShieldAlert;
  return (
    <div
      className={cn(
        "admin-reveal flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        worst === "ok" && "border-chart-3/30 bg-chart-3/[0.06]",
        worst === "warn" && "border-chart-4/40 bg-chart-4/[0.08]",
        worst === "danger" && "border-destructive/40 bg-destructive/[0.08]",
      )}
      style={{ ["--i" as string]: 0 }}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full", TONE_SOFT[worst])}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
            {loading && !stats ? "Reading…" : worst === "ok" ? "All clear" : `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`}
          </div>
          {alerts.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-[12px] leading-snug text-foreground/90">
              {alerts.map((a, i) => (
                <li key={i}>{a.text}</li>
              ))}
            </ul>
          ) : (
            stats && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                No write failures, error rate {stats.errorRate}%, p95 {fmtMs(stats.p95DurationMs)}.
              </p>
            )
          )}
        </div>
      </div>
      {stats && (
        <p className="shrink-0 font-mono text-[11px] text-muted-foreground sm:text-right">
          {periodSentence(period)} · {fmtInt(stats.operationsCount)} ops · {fmtInt(stats.activeUsersPeriod)} active users
        </p>
      )}
    </div>
  );
}

/* ── View ─────────────────────────────────────────────────────────────── */

const METRICS: ReadonlyArray<{ value: TrendMetric; label: string; tone: Tone }> = [
  { value: "operations", label: "Operations", tone: "primary" },
  { value: "tracks", label: "Tracks", tone: "info" },
  { value: "newUsers", label: "New users", tone: "ok" },
];

export function OverviewView({ period, enabled, onInspectErrorCode, onInspectAction }: Props) {
  const statsQ = useAdminStats(period, enabled);
  const dailyQ = useAdminDaily(period, enabled);
  const [metric, setMetric] = React.useState<TrendMetric>("operations");

  const stats = statsQ.data;
  const daily = dailyQ.data ?? [];
  const loading = statsQ.isPending;
  const metricMeta = METRICS.find((m) => m.value === metric) ?? METRICS[0];

  const opsSpark = daily.map((d) => d.operations);
  const tracksSpark = daily.map((d) => d.tracks);
  const usersSpark = daily.map((d) => d.newUsers);

  const outcomeSegments = stats
    ? [
        { key: "ok", label: "Succeeded", pct: Math.max(stats.successRate - stats.splitRate, 0), tone: "ok" as Tone },
        { key: "split", label: "Auto-split", pct: stats.splitRate, count: stats.splitsCount, tone: "warn" as Tone },
        { key: "partial", label: "Partial", pct: stats.partialRate, count: stats.partialCount, tone: "primary" as Tone },
        { key: "error", label: "Errored", pct: stats.errorRate, tone: "danger" as Tone },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {statsQ.isError && (
        <ErrorNotice message={statsQ.error.message || "Could not load stats."} onRetry={() => statsQ.refetch()} />
      )}

      <PulseStrip stats={stats} period={period} loading={loading} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat
          index={1}
          label="Users"
          value={fmtInt(stats?.totalUsers)}
          loading={loading}
          tone="primary"
          sub={
            stats ? (
              <>
                <span className="text-success-text">+{fmtInt(stats.newUsers)}</span> new · {periodLong(period)}
              </>
            ) : null
          }
          aside={usersSpark.length >= 2 ? <Sparkline values={usersSpark} className="text-chart-3" /> : undefined}
        />
        <Stat
          index={2}
          label="Active users"
          value={fmtInt(stats?.activeUsersPeriod)}
          loading={loading}
          tone="info"
          sub={stats ? `ran an operation · ${periodLong(period)}` : null}
        />
        <Stat
          index={3}
          label="Operations"
          value={fmtInt(stats?.operationsCount)}
          loading={loading}
          tone="primary"
          sub={stats ? `${fmtInt(stats.avgTracksPerOp)} tracks per op on average` : null}
          aside={opsSpark.length >= 2 ? <Sparkline values={opsSpark} className="text-primary" /> : undefined}
        />
        <Stat
          index={4}
          label="Tracks processed"
          value={fmtInt(stats?.tracksProcessed)}
          loading={loading}
          tone="info"
          sub={stats ? periodSentence(period) : null}
          aside={tracksSpark.length >= 2 ? <Sparkline values={tracksSpark} className="text-chart-2" /> : undefined}
        />
        <Stat
          index={5}
          label="Success rate"
          value={fmtPct(stats?.successRate)}
          loading={loading}
          tone={stats ? (stats.errorRate >= 10 ? "danger" : stats.errorRate >= 5 ? "warn" : "ok") : "ok"}
          sub={stats ? `${stats.errorRate}% errored · ${stats.partialRate}% partial` : null}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          index={6}
          title="Activity"
          hint={`Per day, ${periodLong(period)}. Hover or use the arrow keys for a day.`}
          action={<Segmented size="sm" label="Metric" options={METRICS} value={metric} onChange={setMetric} />}
        >
          {dailyQ.isPending ? (
            <RowSkeleton rows={1} height="h-[220px]" />
          ) : dailyQ.isError ? (
            <ErrorNotice message="Could not load the daily series." onRetry={() => dailyQ.refetch()} />
          ) : (
            <TrendChart data={daily} metric={metric} label={metricMeta.label} tone={metricMeta.tone} />
          )}
        </Panel>

        <Panel index={7} title="Outcomes" hint="Every operation ends in exactly one of these. Auto-splits are successes that exceeded SoundCloud's 500-track cap.">
          {loading ? (
            <RowSkeleton rows={3} />
          ) : stats && stats.operationsCount > 0 ? (
            <>
              <OutcomeBar segments={outcomeSegments} />
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
                <Mini label="Operations" value={fmtInt(stats.operationsCount)} />
                <Mini label="Tracks / op" value={fmtInt(stats.avgTracksPerOp)} tone="info" />
                <Mini label="Avg latency" value={fmtMs(stats.avgDurationMs)} />
                <Mini label="p95 latency" value={fmtMs(stats.p95DurationMs)} tone={stats.p95DurationMs >= 20_000 ? "warn" : "muted"} />
              </div>
            </>
          ) : (
            <Empty>No operations in this window.</Empty>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          index={8}
          title="Feature usage"
          hint="Operations by feature. Click one to see its log."
          footer={stats?.topFeature ? <>Top feature: <span className="font-medium text-foreground">{stats.topFeature.name}</span> at {fmtInt(stats.topFeature.count)} operations.</> : undefined}
        >
          {loading ? (
            <RowSkeleton rows={6} height="h-5" />
          ) : (
            <BarList
              tone="primary"
              items={(stats?.featureUsage ?? []).slice(0, 12).map((f) => ({
                key: f.key,
                label: f.name,
                value: f.count,
                sub: f.errorCount > 0 ? <span className="text-destructive-text">{f.errorRate}% err</span> : f.avgDurationMs ? fmtMs(f.avgDurationMs) : undefined,
                onClick: () => onInspectAction(f.key),
                title: `Inspect ${f.name} operations`,
              }))}
            />
          )}
        </Panel>

        <Panel
          index={9}
          title="Feature reach"
          hint="Distinct signed-in users who opened each page."
          footer="Page opens carry no SoundCloud content — only which tool was opened."
        >
          {loading ? (
            <RowSkeleton rows={6} height="h-5" />
          ) : (
            <BarList
              tone="info"
              items={(stats?.featureReach ?? []).slice(0, 12).map((f) => ({
                key: f.key,
                label: f.name,
                value: f.users,
                sub: `${fmtInt(f.opens)} opens`,
              }))}
              emptyText="No page opens logged in this window."
            />
          )}
        </Panel>

        <Panel index={10} title="Errors" hint="Top codes and the actions that fail most. Click a code to search the log.">
          {loading ? (
            <RowSkeleton rows={6} height="h-5" />
          ) : !stats || (stats.errorBreakdown.length === 0 && stats.errorRateByAction.length === 0) ? (
            <div className="flex items-center gap-2 rounded-lg border border-chart-3/30 bg-chart-3/[0.06] px-3 py-3 font-mono text-[12px] text-success-text">
              <Activity className="h-4 w-4" aria-hidden="true" /> No errors logged in this window.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {stats.errorBreakdown.length > 0 && (
                <BarList
                  tone="danger"
                  labelWidth="46%"
                  items={stats.errorBreakdown.map((e) => ({
                    key: e.errorCode,
                    label: <span className="font-mono">{e.errorCode}</span>,
                    value: e.count,
                    onClick: e.errorCode === "UNSPECIFIED" ? undefined : () => onInspectErrorCode(e.errorCode),
                    title: e.errorCode === "UNSPECIFIED" ? "Errors logged without a code" : `Search the log for ${e.errorCode}`,
                  }))}
                />
              )}
              {stats.errorRateByAction.length > 0 && (
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Error rate by action</div>
                  <BarList
                    tone="danger"
                    max={100}
                    labelWidth="46%"
                    items={stats.errorRateByAction.map((a) => ({
                      key: a.key,
                      label: a.name,
                      value: a.errorRate,
                      display: `${a.errorRate}%`,
                      sub: `${fmtInt(a.errorCount)} / ${fmtInt(a.count)}`,
                      tone: a.errorRate >= 20 ? ("danger" as Tone) : ("warn" as Tone),
                      onClick: () => onInspectAction(a.key),
                      title: `Inspect ${a.name} operations`,
                    }))}
                  />
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
