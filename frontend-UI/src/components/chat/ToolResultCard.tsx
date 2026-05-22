"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Loader2, AlertCircle } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type TrackDisplay = { id: number; title?: string; artist?: string; genre?: string };
type PlaylistDisplay = { id: number; title?: string; trackCount?: number };
type PairDisplay = {
  playlistA: { id: number; title?: string };
  playlistB: { id: number; title?: string };
  sharedTracks: number;
  overlapPercent: number;
  deepLink?: string;
};
type Proposal = {
  kind: "proposal";
  action: "create_playlist" | "bulk_unlike" | string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  payload: Record<string, unknown>;
  summary: string;
};

export type ToolDisplay =
  | { kind: "tracks"; tracks: TrackDisplay[]; deepLink?: string | null }
  | {
      kind: "playlist_pair";
      summary: {
        playlistA: { title?: string };
        playlistB: { title?: string };
        overlapCount: number;
        overlapPercent: number;
      };
      deepLink?: string | null;
    }
  | { kind: "playlist_pairs"; pairs: PairDisplay[] }
  | { kind: "playlists"; items: PlaylistDisplay[] }
  | Proposal;

/* ───────────────────────── small primitives ──────────────────────────── */

function DeepLinkPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
    >
      {label}
      <ArrowUpRight className="h-3 w-3" />
    </Link>
  );
}

function CardShell({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface/60 px-3.5 py-3 text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ───────────────────────── proposal (action) ──────────────────────────── */

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState<"idle" | "confirming" | "done" | "error" | "cancelled">(
    "idle",
  );
  const [resultText, setResultText] = useState<string>("");
  const destructive = proposal.action === "bulk_unlike";

  const confirm = async () => {
    setStatus("confirming");
    setResultText("");
    try {
      const res = await fetch(`${API_BASE}${proposal.endpoint}`, {
        method: proposal.method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal.payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setResultText(data.error || "Action failed.");
        return;
      }
      fetch(`${API_BASE}/api/library/sync`, { method: "POST", credentials: "include" }).catch(
        () => {},
      );
      setStatus("done");
      if (proposal.action === "create_playlist") {
        const id = data.playlists?.[0]?.id || data.playlist?.id;
        setResultText(id ? `Created playlist (id ${id}).` : "Playlist created.");
      } else if (proposal.action === "bulk_unlike") {
        const ok = Array.isArray(data.results)
          ? data.results.filter((r: { status: string }) => r.status === "ok").length
          : 0;
        setResultText(`Unliked ${ok} track${ok === 1 ? "" : "s"}.`);
      } else {
        setResultText("Done.");
      }
    } catch (e) {
      setStatus("error");
      setResultText(e instanceof Error ? e.message : "Action failed.");
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        destructive ? "border-destructive/30" : "border-primary/30"
      } bg-card`}
    >
      <div
        className={`h-[2px] w-full ${destructive ? "bg-destructive" : "bg-primary"}`}
        aria-hidden
      />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {destructive ? "Confirm to unlike" : "Confirm to create"}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">{proposal.summary}</div>
          </div>
        </div>

        {status === "idle" && (
          <div className="flex gap-2">
            <button
              onClick={confirm}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 ${
                destructive ? "bg-destructive" : "bg-primary"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {destructive ? "Yes, unlike them" : "Create playlist"}
            </button>
            <button
              onClick={() => setStatus("cancelled")}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
        {status === "confirming" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Working…
          </div>
        )}
        {status === "done" && (
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Check className="h-3.5 w-3.5 text-primary" />
            {resultText}
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {resultText}
          </div>
        )}
        {status === "cancelled" && (
          <div className="text-xs text-muted-foreground">Cancelled.</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── main result-card switch ──────────────────────── */

export function ToolResultCard({ display }: { display: ToolDisplay }) {
  if (display.kind === "proposal") return <ProposalCard proposal={display} />;

  if (display.kind === "tracks") {
    if (!display.tracks.length) return null;
    const action = display.deepLink ? (
      <DeepLinkPill href={display.deepLink} label="Open in Like Manager" />
    ) : null;
    return (
      <CardShell label={`${display.tracks.length} tracks`} action={action}>
        <ul className="space-y-1">
          {display.tracks.slice(0, 10).map((t) => (
            <li key={t.id} className="flex items-baseline gap-2">
              <span className="truncate text-foreground">{t.title || `Track ${t.id}`}</span>
              {t.artist && <span className="truncate text-muted-foreground">· {t.artist}</span>}
              {t.genre && (
                <span className="ml-auto shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                  {t.genre}
                </span>
              )}
            </li>
          ))}
          {display.tracks.length > 10 && (
            <li className="text-[11px] text-muted-foreground">
              …and {display.tracks.length - 10} more
            </li>
          )}
        </ul>
      </CardShell>
    );
  }

  if (display.kind === "playlist_pair") {
    const { summary, deepLink } = display;
    return (
      <CardShell
        label={`${summary.overlapCount} shared · ${summary.overlapPercent}%`}
        action={deepLink ? <DeepLinkPill href={deepLink} label="Open comparison" /> : null}
      >
        <div className="text-foreground">
          <span className="font-medium">{summary.playlistA.title}</span>
          <span className="mx-1.5 text-muted-foreground">↔</span>
          <span className="font-medium">{summary.playlistB.title}</span>
        </div>
      </CardShell>
    );
  }

  if (display.kind === "playlist_pairs") {
    if (!display.pairs.length) return null;
    return (
      <CardShell label={`top ${display.pairs.length} overlaps`}>
        <ul className="space-y-1.5">
          {display.pairs.map((p) => (
            <li
              key={`${p.playlistA.id}-${p.playlistB.id}`}
              className="flex items-center justify-between gap-3"
            >
              <span className="truncate">
                <span className="font-medium text-foreground">{p.playlistA.title}</span>
                <span className="mx-1.5 text-muted-foreground">↔</span>
                <span className="font-medium text-foreground">{p.playlistB.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {p.sharedTracks} shared · {p.overlapPercent}%
                </span>
              </span>
              {p.deepLink && <DeepLinkPill href={p.deepLink} label="Compare" />}
            </li>
          ))}
        </ul>
      </CardShell>
    );
  }

  if (display.kind === "playlists") {
    if (!display.items.length) return null;
    return (
      <CardShell label={`${display.items.length} playlists`}>
        <ul className="space-y-0.5">
          {display.items.slice(0, 20).map((p) => (
            <li key={p.id} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-foreground">{p.title || `Playlist ${p.id}`}</span>
              {p.trackCount != null && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.trackCount} tracks
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardShell>
    );
  }

  return null;
}
