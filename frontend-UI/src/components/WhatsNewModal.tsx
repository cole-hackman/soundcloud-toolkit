"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  ClipboardCheck,
  FileUp,
  ArrowRightLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

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
  // Without this, `Dialog` opens on the first focusable element in the panel,
  // which is the corner close button — so the modal announced itself as
  // "Close". "Got it" is the dismissal this modal is actually about.
  const dismissRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What's new in Track Toolkit"
      subtitle="A few new tools since your last visit"
      initialFocusRef={dismissRef}
      icon={
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary shadow-sm">
          <Sparkles className="w-5 h-5 text-primary-foreground" aria-hidden="true" />
        </div>
      }
      footer={
        <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
          {/* A link that looks like the primary button, rather than a
              `<Button>` inside a `<Link>` — that nested a control inside a
              control, which is both invalid and ambiguous to assistive
              technology. Styled the same way the rebrand modal's link is. */}
          <Link
            href={PRIMARY_HREF}
            onClick={onClose}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4",
              "bg-primary text-sm font-semibold text-primary-foreground shadow-elevation-1",
              "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-glow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "sm:flex-1",
            )}
          >
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            Try Grow Your Network
          </Link>
          <Button
            ref={dismissRef}
            variant="outline"
            onClick={onClose}
            className="sm:flex-1"
          >
            Got it
          </Button>
        </div>
      }
    >
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
    </Dialog>
  );
}
