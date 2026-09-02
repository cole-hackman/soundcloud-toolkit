"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Rebrand name vote — a blocking modal.
 *
 * SoundCloud's API terms forbid "SoundCloud" in an app name or its domain, so
 * SC Toolkit has to rename. This modal shows every logged-in user the
 * shortlist and collects a vote plus two optional write-ins.
 *
 * It is deliberately not dismissible: no close button, no Escape, no backdrop
 * click, no snooze. Submitting a vote is the only way past it, and "None of
 * these" is the pressure valve for people who dislike every option.
 *
 * The one exception is a failed submit. If the request errors the modal offers
 * a way out, because a network blip or a backend outage must never lock a user
 * out of a tool they came here to use.
 *
 * The slugs below must stay in sync with REBRAND_NAME_SLUGS in
 * server/middleware/validation.js.
 */
export const CURRENT_NAME = "SC Toolkit";

export type NameChoice =
  | "tracktidy"
  | "deckdig"
  | "sortwave"
  | "deckhaul"
  | "tracktoolkit"
  | "none";

export interface RebrandSubmission {
  nameChoice: NameChoice;
  nameIdea: string;
  featureIdea: string;
}

interface RebrandSurveyModalProps {
  open: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: RebrandSubmission) => void;
  /**
   * Escape hatch, offered only after a submit has failed. Not a dismiss
   * control — the modal is otherwise mandatory.
   */
  onGiveUp: () => void;
}

/**
 * The shortlist. Order is Cole's preference, not the research ranking —
 * TrackTidy and Track Toolkit lead because those are the two he most wants
 * read on. Note that first position measurably attracts votes, so treat the
 * gap between the top two and the rest as soft.
 */
const NAME_OPTIONS: { value: NameChoice; label: string; blurb: string }[] = [
  {
    value: "tracktidy",
    label: "TrackTidy",
    blurb: "Says exactly what it does — clean up your library.",
  },
  {
    value: "tracktoolkit",
    label: "Track Toolkit",
    blurb: "Closest to the current name — least to relearn.",
  },
  {
    value: "deckdig",
    label: "DeckDig",
    blurb: "Crate-digging energy, without the crate clichés.",
  },
  {
    value: "sortwave",
    label: "SortWave",
    blurb: "Short and brandable, leaves room to grow.",
  },
  {
    value: "deckhaul",
    label: "DeckHaul",
    blurb: "Built for moving tracks around in bulk.",
  },
  {
    value: "none",
    label: "None of these",
    blurb: "Tell me what you'd call it below.",
  },
];

export function RebrandSurveyModal({
  open,
  submitting,
  errorMessage,
  onSubmit,
  onGiveUp,
}: RebrandSurveyModalProps) {
  const [nameChoice, setNameChoice] = useState<NameChoice | null>(null);
  const [nameIdea, setNameIdea] = useState("");
  const [featureIdea, setFeatureIdea] = useState("");
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // The control that had focus when the modal opened, so it can be handed
  // focus back on close.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setNameChoice(null);
      setNameIdea("");
      setFeatureIdea("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstOptionRef.current?.focus();
    return () => {
      // Hand focus back where it came from, so closing the modal doesn't dump
      // a keyboard user at the top of the page.
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape deliberately does nothing — this modal is mandatory.
      // aria-modal alone doesn't stop Tab reaching the page behind the
      // dialog, so cycle focus within the panel by hand.
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
  }, [open]);

  const canSubmit = useMemo(
    () => !submitting && nameChoice !== null,
    [submitting, nameChoice],
  );

  if (!open) return null;

  const handleSubmit = () => {
    if (nameChoice === null) return;
    onSubmit({
      nameChoice,
      nameIdea: nameIdea.trim(),
      featureIdea: featureIdea.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Help pick the new name"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      {/* Inert backdrop — clicking outside must not dismiss a mandatory vote. */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={panelRef}
        className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border-2 border-border animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary shadow-sm">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {CURRENT_NAME} is getting a new name
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ~20 seconds · one quick vote to continue
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground leading-relaxed">
            <p>
              I&apos;m Cole, the dev. SoundCloud&apos;s API terms don&apos;t
              allow &quot;SoundCloud&quot; in an app&apos;s name or domain, so
              I&apos;m rebranding the site. Same tools, same login, nothing
              goes away — just a new name and address. I&apos;m asking everyone
              once, and then it&apos;s gone for good.{" "}
              <span className="font-medium text-foreground">
                Which of these would you pick?
              </span>
            </p>
          </div>

          {/* Q1 Name vote */}
          <div className="space-y-1.5">
            {NAME_OPTIONS.map((o, i) => {
              const selected = nameChoice === o.value;
              return (
                <button
                  type="button"
                  key={o.value}
                  ref={i === 0 ? firstOptionRef : undefined}
                  aria-pressed={selected}
                  onClick={() => setNameChoice(o.value)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg border-2 transition-all ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-4 h-4 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selected ? "border-primary" : "border-border"
                      }`}
                    >
                      {selected && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {o.label}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {o.blurb}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Q2 Their own name */}
          <div className="space-y-2">
            <label
              htmlFor="rebrand-name-idea"
              className="text-sm font-semibold text-foreground"
            >
              Got a better one?
            </label>
            <input
              id="rebrand-name-idea"
              type="text"
              value={nameIdea}
              onChange={(e) => setNameIdea(e.target.value)}
              maxLength={120}
              placeholder="Your name idea…"
              className="w-full px-3 py-2 rounded-lg text-sm border-2 border-border bg-background text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Q3 Feature request */}
          <div className="space-y-2">
            <label
              htmlFor="rebrand-feature-idea"
              className="text-sm font-semibold text-foreground"
            >
              Anything you wish this thing did?
            </label>
            <textarea
              id="rebrand-feature-idea"
              value={featureIdea}
              onChange={(e) => setFeatureIdea(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Feature requests welcome — I read every one."
              className="w-full px-3 py-2 rounded-lg text-sm border-2 border-border bg-background text-foreground focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {errorMessage && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}

          {/* Actions — submitting a vote is the only way past this modal. */}
          <div className="space-y-2 pt-1">
            <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
              {submitting ? "Sending…" : nameChoice === null ? "Pick one to continue" : "Submit"}
            </Button>
            {errorMessage ? (
              // Only reachable once a submit has actually failed. Without this
              // an outage would trap people in an unclosable dialog.
              <button
                type="button"
                onClick={onGiveUp}
                disabled={submitting}
                className="w-full text-xs font-medium text-muted-foreground hover:text-foreground py-1.5 transition-colors disabled:opacity-50"
              >
                Skip for now
              </button>
            ) : (
              <p className="text-[11px] text-center text-muted-foreground">
                One vote and you&apos;re done — you won&apos;t see this again.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
