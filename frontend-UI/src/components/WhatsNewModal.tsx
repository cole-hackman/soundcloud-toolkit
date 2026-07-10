"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  X,
  Sparkles,
  TrendingUp,
  ClipboardCheck,
  FileUp,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface WhatsNewModalProps {
  open: boolean;
  /** Called on any dismissal (X, backdrop, Escape, button). Persists "seen". */
  onClose: () => void;
}

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  href?: string;
}

/**
 * Curated list of what to announce. Edit this + bump WHATS_NEW_VERSION in
 * lib/whatsNew.ts to re-announce. Lead with the headline feature.
 */
const FEATURES: Feature[] = [
  {
    icon: TrendingUp,
    title: "Grow Your Network",
    description:
      "Find DJs likely to follow you back, engage with their best tracks, and track — or undo — whole campaigns. Follows are safely paced and capped.",
    href: "/growth",
  },
  {
    icon: ClipboardCheck,
    title: "Library Audit",
    description:
      "Scan your playlists for duplicates, unavailable tracks, and download links in one pass.",
    href: "/library-audit",
  },
  {
    icon: FileUp,
    title: "Export",
    description:
      "Export your likes, playlists, followings, and reposts as TXT or CSV.",
    href: "/export",
  },
  {
    icon: ArrowRightLeft,
    title: "Playlist Compare & Cloner",
    description:
      "Compare two playlists for overlap and gaps, or clone any public playlist to your account.",
    href: "/playlist-compare",
  },
];

const PRIMARY_HREF = "/growth";

export function WhatsNewModal({ open, onClose }: WhatsNewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border-2 border-border animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary shadow-sm">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 id="whats-new-title" className="text-lg font-bold text-foreground">
                What&apos;s new in SC Toolkit
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                A few new tools since your last visit
              </p>
            </div>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {FEATURES.map((f) => {
              const body = (
                <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3 transition-colors group-hover:border-primary/40">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">
                        {f.title}
                      </span>
                      {f.href && (
                        <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {f.description}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={f.title}>
                  {f.href ? (
                    <Link href={f.href} onClick={onClose} className="group block">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
            <Link href={PRIMARY_HREF} onClick={onClose} className="sm:flex-1">
              <Button className="w-full gap-2">
                <TrendingUp className="h-4 w-4" />
                Try Grow Your Network
              </Button>
            </Link>
            <Button variant="outline" onClick={onClose} className="sm:flex-1">
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
