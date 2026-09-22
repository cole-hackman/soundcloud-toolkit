"use client";

import { useRef } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PREVIOUS_PRODUCT_NAME, PRODUCT_NAME } from "@/lib/rebrand";

interface RebrandAnnouncementModalProps {
  open: boolean;
  /** Called on any dismissal (Escape, backdrop, button). Persists the ack. */
  onAcknowledge: () => void;
}

/**
 * One-time rebrand announcement for signed-in users.
 *
 * Deliberately the same shape as WhatsNewModal — both render through the
 * shared `Dialog`, so they get the same backdrop, card, focus trap and
 * dismissal affordances and read as part of the product rather than as an
 * interstitial. The differences are that it carries a single acknowledgement
 * action instead of a feature list, and that dismissing it any way records
 * the ack, because this is news, not a decision to make.
 *
 * Ordering with the other two prompts is handled by the callers: this one
 * takes priority, the dashboard holds "What's new" back until it is
 * acknowledged, and the name vote it supersedes is retired. Nothing stacks.
 */
export function RebrandAnnouncementModal({
  open,
  onAcknowledge,
}: RebrandAnnouncementModalProps) {
  const acknowledgeRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onAcknowledge}
      title={`${PREVIOUS_PRODUCT_NAME} is now ${PRODUCT_NAME}`}
      subtitle="New name, same toolkit"
      initialFocusRef={acknowledgeRef}
      descriptionClassName="space-y-3 leading-relaxed"
      // Acknowledging is the point; the pre-Dialog modal had no corner X and
      // Escape and the backdrop already record the ack.
      showClose={false}
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm">
          <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
        </div>
      }
      description={
        <>
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
        </>
      }
      footer={
        <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
          <Button
            ref={acknowledgeRef}
            onClick={onAcknowledge}
            className="w-full sm:flex-1"
          >
            Got it — take me to {PRODUCT_NAME}
          </Button>
          <Link
            href="/faq/#rebrand"
            onClick={onAcknowledge}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition hover:border-primary/40 hover:text-primary-text sm:flex-1"
          >
            Read the FAQ
          </Link>
        </div>
      }
    />
  );
}

export default RebrandAnnouncementModal;
