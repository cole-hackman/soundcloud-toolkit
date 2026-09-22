"use client";

import * as React from "react";
import { Download, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAbsolute, fmtInt, timeAgo } from "../format";
import {
  Empty,
  ErrorNotice,
  Panel,
  RowSkeleton,
  Segmented,
  Select,
  SmallButton,
  TextField,
  TONE_SOFT,
  type Tone,
} from "../primitives";
import { FEEDBACK_PAGE_SIZE, feedbackCsvUrl, useFeedbackItems, useFeedbackPatch, useFeedbackSummary } from "../queries";
import {
  DEFAULT_FEEDBACK_FILTER,
  FEEDBACK_ACTION_STATUSES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackFilter,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackSummary,
  type FeedbackType,
} from "../types";

/**
 * The live in-app feedback inbox (`POST /api/feedback` → the `Feedback`
 * table), read through `/api/admin/feedback-items*`.
 *
 * It is its own view rather than a panel in Archive on purpose: Archive is
 * closed, read-only history, and this is the one place in the console with a
 * queue an admin is expected to work through.
 *
 * Deliberately not period-scoped. Every other live view narrows to the header's
 * time window; an untriaged report from six weeks ago is still untriaged, so a
 * window filter would hide exactly the rows this view exists to surface.
 */

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  seen: "Seen",
  done: "Done",
  spam: "Spam",
};

const STATUS_TONES: Record<FeedbackStatus, Tone> = {
  new: "primary",
  seen: "info",
  done: "ok",
  spam: "muted",
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Bug",
  feature: "Feature",
  other: "Other",
};

const TYPE_TONES: Record<FeedbackType, Tone> = {
  bug: "danger",
  feature: "info",
  other: "warn",
};

/** Messages longer than this collapse behind a "Show more" toggle. */
const CLAMP = 200;

function toneOf<T extends string>(map: Record<T, Tone>, key: string): Tone {
  return (map as Record<string, Tone>)[key] ?? "muted";
}

function labelOf<T extends string>(map: Record<T, string>, key: string): string {
  return (map as Record<string, string>)[key] ?? String(key || "?").toUpperCase();
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded px-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em]",
        TONE_SOFT[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ── One report ──────────────────────────────────────────────────────────── */

function FeedbackRow({
  item,
  busy,
  onPatch,
}: {
  item: FeedbackItem;
  busy: boolean;
  onPatch: (body: { status?: string; adminNote?: string | null }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  // Seeded from the server on every load, so a refresh after a PATCH shows
  // what was actually stored rather than whatever is still in local state.
  const [note, setNote] = React.useState(item.adminNote ?? "");
  React.useEffect(() => setNote(item.adminNote ?? ""), [item.adminNote]);

  const long = (item.message || "").length > CLAMP;
  const shown = long && !open ? `${item.message.slice(0, CLAMP)}…` : item.message;
  const who = item.user.username ?? (item.soundcloudId != null ? String(item.soundcloudId) : "unknown");
  const bodyId = `feedback-body-${item.id}`;

  const saveNote = () => {
    // Never issue a write that changes nothing: `updatedAt` is `@updatedAt`,
    // so a no-op PATCH still moves it and makes the row look freshly triaged.
    if (note === (item.adminNote ?? "")) return;
    onPatch({ adminNote: note === "" ? null : note });
  };

  return (
    <li
      className={cn(
        "rounded-lg border border-border/70 px-3 py-2.5",
        item.status === "new" ? "bg-primary/[0.05]" : "bg-card/40",
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="font-mono text-[11px] text-muted-foreground" title={fmtAbsolute(item.createdAt)}>
          {timeAgo(item.createdAt)}
        </span>
        <span className="max-w-[180px] truncate font-mono text-[12px] font-medium text-primary" title={item.user.displayName ?? undefined}>
          @{who}
        </span>
        <Pill tone={toneOf(TYPE_TONES, item.type)}>{labelOf(TYPE_LABELS, item.type)}</Pill>
        <Pill tone={toneOf(STATUS_TONES, item.status)}>{labelOf(STATUS_LABELS, item.status)}</Pill>
        <span className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground">
          {item.page || "(no page)"}
        </span>
        {item.email && (
          <a
            href={`mailto:${item.email}`}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-chart-2 underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            <Mail className="h-3 w-3" aria-hidden="true" />
            {item.email}
          </a>
        )}
      </div>

      <p id={bodyId} className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-foreground/90">
        {shown}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 inline-flex h-6 items-center rounded-sm font-mono text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {FEEDBACK_ACTION_STATUSES.map((next) => (
          <SmallButton
            key={next}
            className="h-7"
            tone={next === "spam" ? "danger" : "muted"}
            disabled={busy || item.status === next}
            onClick={() => onPatch({ status: next })}
            // The visible word is also a filter tab above; the accessible name
            // keeps the two apart while still containing the visible text
            // (WCAG 2.5.3 Label in Name).
            aria-label={`Mark as ${next}`}
          >
            {STATUS_LABELS[next]}
          </SmallButton>
        ))}
        <TextField
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          disabled={busy}
          placeholder="Admin note…"
          aria-label={`Admin note for the report from @${who}`}
          // 16px on mobile so iOS does not zoom the console on focus; the
          // console's own 12px from `fieldClass` resumes at sm and up.
          className="h-7 min-w-[180px] flex-1 text-base sm:text-[12px]"
        />
      </div>
    </li>
  );
}

/* ── View ────────────────────────────────────────────────────────────────── */

export function FeedbackView({ enabled }: { enabled: boolean }) {
  const [filter, setFilter] = React.useState<FeedbackFilter>(DEFAULT_FEEDBACK_FILTER);

  const listQ = useFeedbackItems(filter, enabled);
  const summaryQ = useFeedbackSummary(enabled);
  const patch = useFeedbackPatch();

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / FEEDBACK_PAGE_SIZE), 1);
  const summary: FeedbackSummary | undefined = summaryQ.data;
  const unread = summary?.unread ?? 0;

  // Any filter change starts the walk again — page 4 of "new" is rarely page 4
  // of "spam".
  const setStatus = (status: FeedbackFilter["status"]) => setFilter((f) => ({ ...f, status, page: 1 }));
  const setType = (type: FeedbackFilter["type"]) => setFilter((f) => ({ ...f, type, page: 1 }));
  const setPage = (page: number) => setFilter((f) => ({ ...f, page }));

  // Triaging the last row on the last page shortens the list under your feet.
  // Without this you are left on a page that no longer exists, reading "no
  // feedback matches these filters" with a full page 1 behind you.
  React.useEffect(() => {
    if (!listQ.isPending && filter.page > totalPages) setPage(totalPages);
  }, [totalPages, filter.page, listQ.isPending]);

  const statusOptions = [
    ...FEEDBACK_STATUSES.map((s) => ({
      value: s as FeedbackFilter["status"],
      label: (
        <>
          {STATUS_LABELS[s]}
          {summary && <span className="ml-1 text-muted-foreground">{fmtInt(summary.byStatus[s] ?? 0)}</span>}
        </>
      ),
    })),
    {
      value: "" as FeedbackFilter["status"],
      label: (
        <>
          All
          {summary && <span className="ml-1 text-muted-foreground">{fmtInt(summary.total)}</span>}
        </>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel
        index={0}
        title="Feedback inbox"
        hint="Every report from the in-app form, newest first. Login is required to send one, so every row is attributable. Not time-windowed: an untriaged report from six weeks ago is still untriaged."
        padded={false}
        action={
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2 font-mono text-[11px] font-semibold tracking-[0.06em]",
                unread > 0 ? TONE_SOFT.primary : "border border-border/70 text-muted-foreground",
              )}
            >
              {summaryQ.isPending ? "— NEW" : `${fmtInt(unread)} NEW`}
            </span>
            <a
              href={feedbackCsvUrl(filter)}
              title="Download the current filter set as CSV"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 font-mono text-[12px] font-medium text-foreground hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
            </a>
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 pb-3 sm:px-5">
          <Segmented size="sm" label="Status" options={statusOptions} value={filter.status} onChange={setStatus} />
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Filter by feedback type</span>
            <Select value={filter.type} onChange={(e) => setType(e.target.value as FeedbackFilter["type"])}>
              <option value="">All types</option>
              {FEEDBACK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                  {summary ? ` (${summary.byType[t] ?? 0})` : ""}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="px-4 pt-3 sm:px-5">
          {patch.isError && (
            <ErrorNotice message={patch.error.message || "Could not update that report."} className="mb-3" />
          )}

          {listQ.isError ? (
            <ErrorNotice message={listQ.error.message || "Could not load the inbox."} onRetry={() => listQ.refetch()} />
          ) : listQ.isPending ? (
            <RowSkeleton rows={6} height="h-16" />
          ) : items.length === 0 ? (
            <Empty className="mb-4">No feedback matches these filters.</Empty>
          ) : (
            <ul className={cn("flex flex-col gap-2", listQ.isPlaceholderData && "opacity-60 transition-opacity")}>
              {items.map((item) => (
                <FeedbackRow
                  key={item.id}
                  item={item}
                  busy={patch.isPending && patch.variables?.id === item.id}
                  onPatch={(body) => patch.mutate({ id: item.id, ...body })}
                />
              ))}
            </ul>
          )}

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-mono text-[11px] text-muted-foreground">
                {fmtInt(total)} report{total === 1 ? "" : "s"} · page {filter.page} of {fmtInt(totalPages)} · {FEEDBACK_PAGE_SIZE} per page
              </span>
              <div className="flex gap-1.5">
                <SmallButton className="h-7" disabled={filter.page <= 1} onClick={() => setPage(Math.max(filter.page - 1, 1))}>
                  ← Prev
                </SmallButton>
                <SmallButton className="h-7" disabled={filter.page >= totalPages} onClick={() => setPage(Math.min(filter.page + 1, totalPages))}>
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
