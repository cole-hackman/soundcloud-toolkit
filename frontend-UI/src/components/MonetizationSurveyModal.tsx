"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type SurveyPreference = "ads" | "pro" | "donation" | "none" | "other";
export type SurveyLifetime = "interested" | "maybe" | "not_interested";

export interface SurveySubmission {
  preference: SurveyPreference;
  lifetimeInterest: SurveyLifetime | null;
  comment: string;
}

interface MonetizationSurveyModalProps {
  open: boolean;
  context: "dashboard" | "post-merge" | "post-from-likes";
  trackCount?: number;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: SurveySubmission) => void;
  onSnooze: () => void;
  onDontShowAgain: () => void;
  onClose: () => void;
}

const PREFERENCE_OPTIONS: { value: SurveyPreference; label: string; hint: string }[] = [
  { value: "ads", label: "Small ad sidebar on the free version", hint: "Keeps everything free, slightly less clean" },
  { value: "pro", label: "Pro plan with higher limits + extras", hint: "Free tier stays, power users pay" },
  { value: "donation", label: "Donation / tip option", hint: "Pay if it helped you" },
  { value: "none", label: "I'd rather not see monetization", hint: "Keep it free, no ads, no tiers" },
  { value: "other", label: "Other", hint: "Tell me what would feel right" },
];

const LIFETIME_OPTIONS: { value: SurveyLifetime; label: string }[] = [
  { value: "interested", label: "Yes, interested" },
  { value: "maybe", label: "Maybe" },
  { value: "not_interested", label: "No" },
];

export function MonetizationSurveyModal({
  open,
  context,
  trackCount,
  submitting,
  errorMessage,
  onSubmit,
  onSnooze,
  onDontShowAgain,
  onClose,
}: MonetizationSurveyModalProps) {
  const [preference, setPreference] = useState<SurveyPreference | null>(null);
  const [lifetime, setLifetime] = useState<SurveyLifetime | null>(null);
  const [comment, setComment] = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setPreference(null);
      setLifetime(null);
      setComment("");
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = preference !== null && !submitting;

  const postOpLine =
    context !== "dashboard" && typeof trackCount === "number" && trackCount > 0
      ? `You just processed ${trackCount.toLocaleString()} tracks — quick question before you go.`
      : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      <div
        className="relative w-full max-w-lg bg-white dark:bg-card rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-border animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#666] dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-[#FF5500] to-[#E64A00] shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#333333] dark:text-foreground">
                Quick question
              </h2>
              <p className="text-xs text-[#666] dark:text-muted-foreground mt-0.5">
                ~30 seconds · helps shape the future of SC Toolkit
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="text-sm text-[#555555] dark:text-muted-foreground leading-relaxed space-y-2">
            <p>
              I&apos;m Cole, the solo dev behind SC Toolkit. We&apos;ve crossed 2k+ users
              and hosting + API costs are starting to add up.
            </p>
            <p>
              I&apos;d love your take on how to keep this sustainable without ruining
              what makes it useful.
            </p>
            {postOpLine && (
              <p className="text-[#FF5500] dark:text-[#FF7733] font-medium">
                {postOpLine}
              </p>
            )}
          </div>

          {/* Preference question */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#333333] dark:text-foreground">
              Which would you prefer?
            </label>
            <div className="space-y-1.5">
              {PREFERENCE_OPTIONS.map((opt) => {
                const selected = preference === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setPreference(opt.value)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border-2 transition-all ${
                      selected
                        ? "border-[#FF5500] bg-orange-50 dark:bg-[#FF5500]/10"
                        : "border-gray-200 dark:border-border hover:border-gray-300 dark:hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          selected
                            ? "border-[#FF5500]"
                            : "border-gray-300 dark:border-border"
                        }`}
                      >
                        {selected && (
                          <span className="w-2 h-2 rounded-full bg-[#FF5500]" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#333333] dark:text-foreground">
                          {opt.label}
                        </div>
                        <div className="text-xs text-[#777] dark:text-muted-foreground mt-0.5">
                          {opt.hint}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lifetime question */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#333333] dark:text-foreground">
              Would you be interested in a one-time lifetime key tied to your SoundCloud account?
            </label>
            <div className="flex gap-2 flex-wrap">
              {LIFETIME_OPTIONS.map((opt) => {
                const selected = lifetime === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setLifetime(selected ? null : opt.value)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      selected
                        ? "border-[#FF5500] bg-[#FF5500] text-white"
                        : "border-gray-200 dark:border-border text-[#555] dark:text-foreground hover:border-gray-300 dark:hover:border-border/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#333333] dark:text-foreground">
              What would feel fair? <span className="text-[#999] font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="e.g. ‘a $15 lifetime key would feel about right’"
              className="w-full px-3 py-2 rounded-lg text-sm border-2 border-gray-200 dark:border-border bg-white dark:bg-background text-[#333] dark:text-foreground focus:border-[#FF5500] focus:outline-none resize-none"
            />
          </div>

          {errorMessage && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <Button
              onClick={() =>
                preference !== null &&
                onSubmit({
                  preference,
                  lifetimeInterest: lifetime,
                  comment: comment.trim(),
                })
              }
              disabled={!canSubmit}
              className="w-full"
            >
              {submitting ? "Sending…" : "Submit"}
            </Button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSnooze}
                disabled={submitting}
                className="flex-1 text-xs font-medium text-[#666] dark:text-muted-foreground hover:text-[#333] dark:hover:text-foreground py-1.5 transition-colors disabled:opacity-50"
              >
                Ask me later
              </button>
              <span className="text-[#ccc] dark:text-border">·</span>
              <button
                type="button"
                onClick={onDontShowAgain}
                disabled={submitting}
                className="flex-1 text-xs font-medium text-[#666] dark:text-muted-foreground hover:text-[#333] dark:hover:text-foreground py-1.5 transition-colors disabled:opacity-50"
              >
                Don&apos;t show again
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
