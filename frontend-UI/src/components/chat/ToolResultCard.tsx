"use client";

import { useState } from "react";
import Link from "next/link";

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
  | { kind: "playlist_pair"; summary: { playlistA: { title?: string }; playlistB: { title?: string }; overlapCount: number; overlapPercent: number }; deepLink?: string | null }
  | { kind: "playlist_pairs"; pairs: PairDisplay[] }
  | { kind: "playlists"; items: PlaylistDisplay[] }
  | Proposal;

const Btn = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    className="inline-block rounded-md border px-3 py-1 text-xs hover:bg-accent"
  >
    {label}
  </Link>
);

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [status, setStatus] = useState<"idle" | "confirming" | "done" | "error">("idle");
  const [resultText, setResultText] = useState<string>("");

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
      // After a mutation, trigger a library re-sync so subsequent questions see fresh data.
      fetch(`${API_BASE}/api/library/sync`, { method: "POST", credentials: "include" }).catch(() => {});
      setStatus("done");
      if (proposal.action === "create_playlist") {
        const id = data.playlists?.[0]?.id || data.playlist?.id;
        setResultText(id ? `Created playlist (id ${id}).` : "Playlist created.");
      } else if (proposal.action === "bulk_unlike") {
        const ok = Array.isArray(data.results) ? data.results.filter((r: { status: string }) => r.status === "ok").length : 0;
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
    <div className="my-2 space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <div className="font-medium">{proposal.summary}</div>
      {status === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={confirm}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90"
          >
            Confirm
          </button>
          <button
            onClick={() => setStatus("done")}
            className="rounded-md border px-3 py-1 text-xs hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      )}
      {status === "confirming" && <div className="text-xs text-muted-foreground">Working…</div>}
      {status === "done" && resultText && <div className="text-xs">{resultText}</div>}
      {status === "error" && <div className="text-xs text-destructive">{resultText}</div>}
    </div>
  );
}

export function ToolResultCard({ display }: { display: ToolDisplay }) {
  if (display.kind === "proposal") {
    return <ProposalCard proposal={display} />;
  }
  if (display.kind === "tracks") {
    if (!display.tracks.length) return null;
    return (
      <div className="my-2 space-y-2 rounded-md border bg-card p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{display.tracks.length} track{display.tracks.length === 1 ? "" : "s"}</span>
          {display.deepLink && <Btn href={display.deepLink} label="Open in Like Manager" />}
        </div>
        <ul className="space-y-0.5 text-muted-foreground">
          {display.tracks.slice(0, 10).map((t) => (
            <li key={t.id}>
              <span className="text-foreground">{t.title || `Track ${t.id}`}</span>
              {t.artist && <span> — {t.artist}</span>}
              {t.genre && <span className="ml-2 text-xs">[{t.genre}]</span>}
            </li>
          ))}
          {display.tracks.length > 10 && (
            <li className="text-xs">…and {display.tracks.length - 10} more</li>
          )}
        </ul>
      </div>
    );
  }

  if (display.kind === "playlist_pair") {
    const { summary, deepLink } = display;
    return (
      <div className="my-2 flex items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm">
        <span>
          <span className="font-medium">{summary.playlistA.title}</span> ↔{" "}
          <span className="font-medium">{summary.playlistB.title}</span>: {summary.overlapCount} shared ({summary.overlapPercent}%)
        </span>
        {deepLink && <Btn href={deepLink} label="Open Comparison" />}
      </div>
    );
  }

  if (display.kind === "playlist_pairs") {
    if (!display.pairs.length) return null;
    return (
      <div className="my-2 space-y-1 rounded-md border bg-card p-3 text-sm">
        {display.pairs.map((p) => (
          <div key={`${p.playlistA.id}-${p.playlistB.id}`} className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium">{p.playlistA.title}</span> ↔{" "}
              <span className="font-medium">{p.playlistB.title}</span>: {p.sharedTracks} shared ({p.overlapPercent}%)
            </span>
            {p.deepLink && <Btn href={p.deepLink} label="Compare" />}
          </div>
        ))}
      </div>
    );
  }

  if (display.kind === "playlists") {
    if (!display.items.length) return null;
    return (
      <div className="my-2 space-y-0.5 rounded-md border bg-card p-3 text-sm">
        <span className="font-medium">{display.items.length} playlist{display.items.length === 1 ? "" : "s"}</span>
        <ul className="text-muted-foreground">
          {display.items.slice(0, 20).map((p) => (
            <li key={p.id}>
              <span className="text-foreground">{p.title || `Playlist ${p.id}`}</span>
              {p.trackCount != null && <span> · {p.trackCount} tracks</span>}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}
