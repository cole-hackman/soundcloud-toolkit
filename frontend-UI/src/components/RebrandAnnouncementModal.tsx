"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PREVIOUS_PRODUCT_NAME, PRODUCT_NAME } from "@/lib/rebrand";

interface RebrandAnnouncementModalProps {
  open: boolean;
  /** Called on any dismissal (Escape, backdrop, button). Persists the ack. */
  onAcknowledge: () => void;
}

/**
 * One-time rebrand announcement for signed-in users.
 *
 * Deliberately the same shape as WhatsNewModal — same z-index, backdrop,
 * card, and dismissal affordances — so it reads as part of the product rather
 * than as an interstitial. The differences are that it carries a single
 * acknowledgement action instead of a feature list, and that dismissing it any
 * way records the ack, because this is news, not a decision to make.
 *
 * Ordering with the other two prompts is handled by the callers: this one
 * takes priority, the dashboard holds "What's new" back until it is
 * acknowledged, and the name vote it supersedes is retired. Nothing stacks.
 */
export function RebrandAnnouncementModal({
  open,
  onAcknowledge,
}: RebrandAnnouncementModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const acknowledgeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    acknowledgeRef.current?.focus();
    return () => {
      // Hand focus back where it came from, so closing doesn't dump a keyboard
      // user at the top of the page.
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onAcknowledge();
        return;
      }
      // aria-modal alone doesn't stop Tab reaching the page behind the dialog,
      // so cycle focus within the panel by hand.
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onAcknowledge]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rebrand-announcement-title"
      aria-describedby="rebrand-announcement-body"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onAcknowledge}
      />

      <div
        ref={panelRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-5 px-6 py-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
              <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="rebrand-announcement-title"
                className="text-lg font-bold text-foreground"
              >
                {PREVIOUS_PRODUCT_NAME} is now {PRODUCT_NAME}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                New name, same toolkit
              </p>
            </div>
          </div>

          <div
            id="rebrand-announcement-body"
            className="space-y-3 text-sm leading-relaxed text-muted-foreground"
          >
            <p>
              We&apos;ve renamed to <strong className="text-foreground">{PRODUCT_NAME}</strong>.
              SoundCloud&apos;s API terms don&apos;t allow &quot;SoundCloud&quot; in an
              app&apos;s name, so the old one had to go — and you picked the
              replacement.
            </p>
            <p>
              <strong className="text-foreground">Nothing else changes.</strong> Your
              account, your SoundCloud connection, your playlists and every tool you
              already use carry on exactly as before. There is nothing for you to do,
              and nothing to sign up for again.
            </p>
            <p>
              Thank you for using it, for voting on the name, and for every feature
              request that shaped it. It&apos;s still the same free toolkit, built for
              people who care about their libraries.
            </p>
          </div>

          <div className="pt-1">
            <Button ref={acknowledgeRef} onClick={onAcknowledge} className="w-full">
              Got it — take me to {PRODUCT_NAME}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RebrandAnnouncementModal;
