"use client";

import * as React from "react";
import { Download, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAbsolute, fmtInt, timeAgo } from "../format";
import { BarList, Empty, ErrorNotice, Mini, Panel, RowSkeleton, Segmented, TableShell, tdClass, thClass, type Tone } from "../primitives";
import { useBetaSurveySummary, useRebrandSummary, useRebrandVotes } from "../queries";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// Rebrand name-vote shortlist — historical. The vote is closed (Track Toolkit
// won) and the voting modal is gone, so this order is frozen as the sequence
// voters actually saw. The slugs still match REBRAND_NAME_SLUGS in
// server/middleware/validation.js, which the stored rows were validated against.
const REBRAND_NAME_ORDER = ["tracktidy", "tracktoolkit", "deckdig", "sortwave", "deckhaul", "none"] as const;
const REBRAND_NAME_LABELS: Record<string, string> = {
  tracktidy: "TrackTidy",
  deckdig: "DeckDig",
  sortwave: "SortWave",
  deckhaul: "DeckHaul",
  tracktoolkit: "Track Toolkit",
  none: "None of these",
};
const DECIDED_NAME = "tracktoolkit";

function toBarItems(counts: Record<string, number> | undefined, tone: Tone) {
  return Object.entries(counts ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: k, value: v, tone }));
}

export function ArchiveView({ enabled }: { enabled: boolean }) {
  const summaryQ = useRebrandSummary(enabled);
  const votesQ = useRebrandVotes(enabled);
  const betaQ = useBetaSurveySummary(enabled);
  const [voteScope, setVoteScope] = React.useState<"writeins" | "all">("writeins");

  const summary = summaryQ.data;
  const votes = votesQ.data ?? [];
  const shownVotes = voteScope === "all" ? votes : votes.filter((v) => v.nameIdea || v.featureIdea);
  const total = Math.max(summary?.total ?? 0, 1);
  const winnerCount = summary?.nameChoice?.[DECIDED_NAME] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="admin-reveal flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        style={{ ["--i" as string]: 0 }}
      >
        <p className="text-[12px] leading-snug text-muted-foreground">
          Everything here is <span className="font-medium text-foreground">closed and read-only</span>. Nothing polls, nothing is period-filtered, and no
          row can be changed from this console.
        </p>
      </div>

      <Panel
        index={1}
        title="Rebrand name vote"
        hint="Closed 2026-09-10. The write path answers 410; rows are retained."
        action={
          summary ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-chart-3/12 px-2 py-1 font-mono text-[11px] font-semibold text-success-text">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              {REBRAND_NAME_LABELS[DECIDED_NAME]} · {fmtInt(winnerCount)} of {fmtInt(summary.total)}
            </span>
          ) : undefined
        }
      >
        {summaryQ.isError ? (
          <ErrorNotice message="Could not load the vote tally." onRetry={() => summaryQ.refetch()} />
        ) : summaryQ.isPending ? (
          <RowSkeleton rows={6} height="h-5" />
        ) : !summary || summary.total === 0 ? (
          <Empty>No votes were recorded.</Empty>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <BarList
              tone="muted"
              labelWidth="34%"
              items={REBRAND_NAME_ORDER.map((key) => {
                const count = summary.nameChoice[key] ?? 0;
                return {
                  key,
                  label: key === DECIDED_NAME ? <span className="font-semibold text-foreground">{REBRAND_NAME_LABELS[key]}</span> : REBRAND_NAME_LABELS[key],
                  value: count,
                  display: fmtInt(count),
                  sub: `${Math.round((count / total) * 100)}%`,
                  tone: key === DECIDED_NAME ? ("primary" as Tone) : key === "none" ? ("danger" as Tone) : ("muted" as Tone),
                };
              })}
            />
            <div className="grid grid-cols-3 gap-4 self-start lg:grid-cols-1 lg:gap-5">
              <Mini label="Responses" value={fmtInt(summary.total)} />
              <Mini label="Write-in names" value={fmtInt(summary.nameIdeaCount)} tone="info" />
              <Mini label="Feature requests" value={fmtInt(summary.featureIdeaCount)} tone="primary" />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        index={2}
        title="Write-ins and feature requests"
        hint="Newest first, up to 200 rows. The free-text fields are the reason to read this table."
        padded={false}
        action={
          <Segmented
            size="sm"
            label="Rows"
            value={voteScope}
            onChange={setVoteScope}
            options={[
              { value: "writeins", label: "With text" },
              { value: "all", label: "All" },
            ]}
          />
        }
      >
        <div className="px-4 pt-1 sm:px-5">
          {votesQ.isError ? (
            <ErrorNotice message="Could not load votes." onRetry={() => votesQ.refetch()} className="mb-4" />
          ) : votesQ.isPending ? (
            <RowSkeleton rows={6} />
          ) : shownVotes.length === 0 ? (
            <Empty className="mb-4">{voteScope === "writeins" ? "No vote carried a write-in or feature request." : "No votes were recorded."}</Empty>
          ) : (
            <TableShell minWidth={760}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>User</th>
                  <th scope="col" className={thClass}>Voted</th>
                  <th scope="col" className={thClass}>Their name</th>
                  <th scope="col" className={cn(thClass, "w-[40%]")}>Feature request</th>
                  <th scope="col" className={thClass}>When</th>
                </tr>
              </thead>
              <tbody>
                {shownVotes.map((v) => (
                  <tr key={v.id} className="align-top hover:bg-primary/[0.04]">
                    <td className={cn(tdClass, "max-w-[150px] truncate font-mono text-[12px] font-medium text-primary-text")}>@{v.user.username}</td>
                    <td className={cn(tdClass, "whitespace-nowrap", v.nameChoice === DECIDED_NAME ? "font-semibold text-foreground" : "text-foreground/80")}>
                      {REBRAND_NAME_LABELS[v.nameChoice] || v.nameChoice}
                    </td>
                    <td className={cn(tdClass, "text-foreground/90")}>{v.nameIdea || <span className="text-muted-foreground">—</span>}</td>
                    <td className={cn(tdClass, "whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/90")}>{v.featureIdea || <span className="text-muted-foreground">—</span>}</td>
                    <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(v.createdAt)}>
                      {timeAgo(v.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      </Panel>

      <Panel
        index={3}
        title="SongSwipe beta survey"
        hint="Retired. Aggregates only; the invite list downloads as CSV."
        action={
          <a
            href={`${API_BASE}/api/admin/feedback/beta-emails?period=all`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 font-mono text-[12px] font-medium text-foreground hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Beta emails CSV
          </a>
        }
      >
        {betaQ.isError ? (
          <ErrorNotice message="Could not load the survey summary." onRetry={() => betaQ.refetch()} />
        ) : betaQ.isPending ? (
          <RowSkeleton rows={3} />
        ) : !betaQ.data || betaQ.data.total === 0 ? (
          <Empty>No survey responses were recorded.</Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
              <Mini label="Responses" value={fmtInt(betaQ.data.total)} />
              <Mini label="Want the beta" value={fmtInt(betaQ.data.wantsBetaCount)} tone="ok" />
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Interest</div>
              <BarList tone="info" items={toBarItems(betaQ.data.interest, "info")} />
            </div>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Platform</div>
              <BarList tone="primary" items={toBarItems(betaQ.data.platform, "primary")} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
