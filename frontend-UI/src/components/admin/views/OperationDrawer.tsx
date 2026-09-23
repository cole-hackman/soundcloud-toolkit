"use client";

import * as React from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtAbsolute, fmtInt, fmtMs } from "../format";
import { Eyebrow, SmallButton, StatusPill, TONE_TEXT, type Tone } from "../primitives";
import type { OperationRow } from "../types";

/* ── Small pieces ─────────────────────────────────────────────────────── */

function Fact({ label, children, tone }: { label: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <Eyebrow className="text-[10px] tracking-[0.1em]">{label}</Eyebrow>
      <div className={cn("mt-1 break-words font-mono text-[12.5px] font-medium text-foreground", tone && TONE_TEXT[tone])}>{children}</div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <SmallButton onClick={copy} aria-label={label} className="h-7 px-2">
      {done ? <Check className="h-3.5 w-3.5 text-success-text" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {done ? "Copied" : "Copy"}
    </SmallButton>
  );
}

function IdList({ title, ids, tone }: { title: string; ids: unknown[]; tone: Tone }) {
  const [expanded, setExpanded] = React.useState(false);
  const all = ids.map(String);
  const shown = expanded ? all : all.slice(0, 40);
  return (
    <section className="rounded-lg border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow className={cn("text-[10px] tracking-[0.1em]", TONE_TEXT[tone])}>
          {title} · {fmtInt(all.length)}
        </Eyebrow>
        <CopyButton text={all.join(", ")} label={`Copy ${title.toLowerCase()}`} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-1">
        {shown.map((id, i) => (
          <li key={`${id}-${i}`} className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground/90 ring-1 ring-border/60">
            {id}
          </li>
        ))}
      </ul>
      {all.length > shown.length && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-2 font-mono text-[11px] text-primary-text hover:underline">
          Show all {fmtInt(all.length)}
        </button>
      )}
    </section>
  );
}

/* ── Drawer ───────────────────────────────────────────────────────────── */

interface Props {
  op: OperationRow | null;
  onClose: () => void;
  onFilterUser: (username: string) => void;
}

export function OperationDrawer({ op, onClose, onFilterUser }: Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const open = op != null;

  React.useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus();
    };
  }, [open]);

  if (!op) return null;

  const meta = (op.metadata ?? {}) as Record<string, unknown>;
  const trackIds = Array.isArray(meta.trackIds) ? meta.trackIds : null;
  const playlistIds = Array.isArray(meta.playlistIds) ? meta.playlistIds : null;
  const targetUserIds = Array.isArray(meta.targetUserIds) ? meta.targetUserIds : null;
  const rest: Record<string, unknown> = { ...meta };
  delete rest.trackIds;
  delete rest.playlistIds;
  delete rest.targetUserIds;
  const restKeys = Object.keys(rest);
  const items = op.trackCount || op.itemCount || 0;
  const scId = op.soundcloudId ?? op.user.soundcloudId;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="presentation">
      <button type="button" aria-label="Close inspector" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="op-drawer-title"
        className="admin-drawer relative flex h-full w-full max-w-[560px] flex-col border-l border-border/80 bg-card shadow-elevation-3"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <Eyebrow>Operation inspector</Eyebrow>
            <h2 id="op-drawer-title" className="mt-1 flex flex-wrap items-center gap-2 font-display text-lg font-semibold leading-tight text-foreground">
              {op.actionName}
              <StatusPill status={op.status} />
            </h2>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              <span className="text-foreground/70">{op.action}</span> · {fmtAbsolute(op.createdAt)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:grid-cols-3">
            <Fact label="User" tone="primary">
              <button type="button" onClick={() => onFilterUser(op.user.username)} className="hover:underline" title="Filter the log to this user">
                @{op.user.username}
              </button>
              {op.user.displayName && op.user.displayName !== op.user.username && (
                <div className="font-normal text-muted-foreground">{op.user.displayName}</div>
              )}
            </Fact>
            <Fact label="SoundCloud id">{scId ?? "—"}</Fact>
            <Fact label="Items">{fmtInt(items)}</Fact>
            <Fact label="Duration" tone="info">{fmtMs(op.durationMs)}</Fact>
            <Fact label="Log id">
              <span className="break-all text-[11px] font-normal text-muted-foreground">{op.id}</span>
            </Fact>
            {op.clientInfo && (
              <Fact label="Client">
                <span className="font-normal">
                  {[op.clientInfo.device, op.clientInfo.browser, op.clientInfo.platform].filter(Boolean).join(" · ") || "—"}
                </span>
              </Fact>
            )}
          </div>

          {(op.errorCode || op.errorMessage) && (
            <section className="rounded-lg border border-destructive/40 bg-destructive/[0.08] p-3">
              <Eyebrow className="text-[10px] tracking-[0.1em] text-destructive-text">Error · {op.errorCode || "no code"}</Eyebrow>
              <p className="mt-1.5 break-words font-mono text-[12px] leading-relaxed text-foreground">{op.errorMessage || "No message recorded."}</p>
            </section>
          )}

          {trackIds && <IdList title="Track ids" ids={trackIds} tone="info" />}
          {playlistIds && <IdList title="Playlist ids" ids={playlistIds} tone="primary" />}
          {targetUserIds && <IdList title="Target user ids" ids={targetUserIds} tone="warn" />}

          <section>
            <div className="flex items-center justify-between gap-2">
              <Eyebrow className="text-[10px] tracking-[0.1em]">{restKeys.length > 0 ? "Other metadata" : "Metadata"}</Eyebrow>
              <CopyButton text={JSON.stringify(op.metadata ?? {}, null, 2)} label="Copy full metadata JSON" />
            </div>
            {restKeys.length > 0 ? (
              <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-1.5 rounded-lg border border-border/70 bg-background p-3 font-mono text-[11.5px]">
                {restKeys.map((k) => (
                  <React.Fragment key={k}>
                    <dt className="truncate text-muted-foreground" title={k}>{k}</dt>
                    <dd className="break-words text-foreground">{typeof rest[k] === "object" ? JSON.stringify(rest[k]) : String(rest[k])}</dd>
                  </React.Fragment>
                ))}
              </dl>
            ) : (
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">{trackIds || playlistIds || targetUserIds ? "Nothing beyond the id lists above." : "No metadata recorded."}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
