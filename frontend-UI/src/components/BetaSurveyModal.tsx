"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, X, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Working product name for the Rekordbox app. Cole is exploring a "DJ Toolkit"
 * umbrella brand and a possible rename to "TrackToolkit"; keeping the name here
 * as one constant makes that rebrand a one-line change. The survey also asks
 * users for name ideas (see the name question below).
 */
export const SONGSWIPE_NAME = "SongSwipe";

export type RekordboxUse =
  | "rekordbox_primary"
  | "rekordbox_sometimes"
  | "other_software"
  | "no";
export type Platform = "mac" | "windows" | "both";
export type CullMethod = "dont" | "manual" | "tedious" | "other_tool";
export type TrustDirectWrite = "yes" | "maybe" | "xml_only";
export type Interest = "very" | "somewhat" | "not";

export interface BetaSubmission {
  rekordboxUse: RekordboxUse;
  platform: Platform | null;
  cullMethod: CullMethod | null;
  featuresWanted: string[];
  editHesitations: string[];
  trustDirectWrite: TrustDirectWrite | null;
  interest: Interest;
  wantsBeta: boolean;
  email: string;
  wantsCall: boolean;
  suggestions: string;
  nameIdea: string;
}

interface BetaSurveyModalProps {
  open: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: BetaSubmission) => void;
  onSnooze: () => void;
  onDontShowAgain: () => void;
  onClose: () => void;
}

const REKORDBOX_OPTIONS: { value: RekordboxUse; label: string }[] = [
  { value: "rekordbox_primary", label: "Yes — it's my main setup" },
  { value: "rekordbox_sometimes", label: "Sometimes / alongside other software" },
  { value: "other_software", label: "I DJ, but on other software" },
  { value: "no", label: "I don't DJ with Rekordbox" },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "mac", label: "macOS" },
  { value: "windows", label: "Windows" },
  { value: "both", label: "Both" },
];

const CULL_OPTIONS: { value: CullMethod; label: string }[] = [
  { value: "dont", label: "I don't — it just grows" },
  { value: "manual", label: "Manually, playlist by playlist" },
  { value: "tedious", label: "I have a system, but it's a chore" },
  { value: "other_tool", label: "Spreadsheet / another tool" },
];

const FEATURE_OPTIONS: { value: string; label: string }[] = [
  { value: "swipe_cull", label: "Swipe/keyboard to keep or cull fast" },
  { value: "waveform_cue", label: "Waveform with jump-to-hot-cue" },
  { value: "skip_presets", label: "Skip presets (Intro / 32 bars / Drop / Outro)" },
  { value: "rate_tag", label: "Rate & color-tag while triaging" },
  { value: "smart_rules", label: "Auto-suggest keep/cull by BPM, rating, key" },
  { value: "dupes", label: "Duplicate detection" },
  { value: "ab_compare", label: "A/B compare two tracks" },
  { value: "stats", label: "Stats (keep ratio, BPM, color spread)" },
];

const HESITATION_OPTIONS: { value: string; label: string }[] = [
  { value: "corrupt_db", label: "Corrupting my Rekordbox database" },
  { value: "lose_cues", label: "Losing hot cues / beatgrids" },
  { value: "delete_files", label: "Deleting files by accident" },
  { value: "trust_thirdparty", label: "Trusting a third-party tool" },
  { value: "none", label: "None — sounds fine" },
];

const TRUST_OPTIONS: { value: TrustDirectWrite; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "xml_only", label: "No — I'd only use XML export" },
];

const INTEREST_OPTIONS: { value: Interest; label: string }[] = [
  { value: "very", label: "Very interested" },
  { value: "somewhat", label: "Somewhat" },
  { value: "not", label: "Not for me" },
];

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function BetaSurveyModal({
  open,
  submitting,
  errorMessage,
  onSubmit,
  onSnooze,
  onDontShowAgain,
  onClose,
}: BetaSurveyModalProps) {
  const [rekordboxUse, setRekordboxUse] = useState<RekordboxUse | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [cullMethod, setCullMethod] = useState<CullMethod | null>(null);
  const [featuresWanted, setFeaturesWanted] = useState<Set<string>>(new Set());
  const [editHesitations, setEditHesitations] = useState<Set<string>>(new Set());
  const [trustDirectWrite, setTrustDirectWrite] = useState<TrustDirectWrite | null>(null);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [wantsBeta, setWantsBeta] = useState(false);
  const [email, setEmail] = useState("");
  const [wantsCall, setWantsCall] = useState(false);
  const [suggestions, setSuggestions] = useState("");
  const [nameIdea, setNameIdea] = useState("");

  useEffect(() => {
    if (open) {
      setRekordboxUse(null);
      setPlatform(null);
      setCullMethod(null);
      setFeaturesWanted(new Set());
      setEditHesitations(new Set());
      setTrustDirectWrite(null);
      setInterest(null);
      setWantsBeta(false);
      setEmail("");
      setWantsCall(false);
      setSuggestions("");
      setNameIdea("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  // Auto-check beta when they express interest (they can uncheck).
  useEffect(() => {
    if (interest === "very" || interest === "somewhat") setWantsBeta(true);
    if (interest === "not") setWantsBeta(false);
  }, [interest]);

  const notRekordbox = rekordboxUse === "no";

  const emailValid = !wantsBeta || isValidEmail(email);
  const canSubmit = useMemo(() => {
    if (submitting || rekordboxUse === null) return false;
    if (notRekordbox) return true; // short path: only qualifier needed
    return interest !== null && emailValid;
  }, [submitting, rekordboxUse, notRekordbox, interest, emailValid]);

  if (!open) return null;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const handleSubmit = () => {
    if (rekordboxUse === null) return;
    onSubmit({
      rekordboxUse,
      platform,
      cullMethod,
      featuresWanted: Array.from(featuresWanted),
      editHesitations: Array.from(editHesitations),
      trustDirectWrite,
      interest: notRekordbox ? "not" : (interest ?? "not"),
      wantsBeta: notRekordbox ? false : wantsBeta,
      email: email.trim(),
      wantsCall,
      suggestions: suggestions.trim(),
      nameIdea: nameIdea.trim(),
    });
  };

  const radioRow = <T extends string>(
    value: T,
    current: T | null,
    onSelect: (v: T) => void,
    label: string,
  ) => {
    const selected = current === value;
    return (
      <button
        type="button"
        key={value}
        onClick={() => onSelect(value)}
        className={`w-full text-left px-3.5 py-2.5 rounded-lg border-2 transition-all ${
          selected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              selected ? "border-primary" : "border-border"
            }`}
          >
            {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
          </span>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
      </button>
    );
  };

  const checkChip = (set: Set<string>, setter: (s: Set<string>) => void, value: string, label: string) => {
    const selected = set.has(value);
    return (
      <button
        type="button"
        key={value}
        onClick={() => toggle(set, setter, value)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:border-primary/40"
        }`}
      >
        {selected && <Check className="w-3 h-3" />}
        {label}
      </button>
    );
  };

  const label = (text: string, required?: boolean) => (
    <label className="text-sm font-semibold text-foreground">
      {text}
      {required && <span className="text-primary"> *</span>}
    </label>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${SONGSWIPE_NAME} beta survey`}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={submitting ? undefined : onClose}
      />

      <div
        className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border-2 border-border animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
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
              <h2 className="text-lg font-bold text-foreground">
                Building {SONGSWIPE_NAME} — want in early?
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                ~1 min · shape a swipe-to-cull tool for Rekordbox
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground leading-relaxed">
            <p>
              I&apos;m Cole (the dev behind SC Toolkit). I&apos;m building{" "}
              <span className="font-medium text-foreground">{SONGSWIPE_NAME}</span> — a
              Tinder-style way to cull your Rekordbox library fast: swipe through
              tracks, preview waveforms and hot cues, then write ratings and
              playlist changes back safely (with an automatic backup, never
              deleting files). Mind a few quick questions?
            </p>
          </div>

          {/* Q1 Rekordbox */}
          <div className="space-y-2">
            {label("Do you DJ with Rekordbox?", true)}
            <div className="space-y-1.5">
              {REKORDBOX_OPTIONS.map((o) =>
                radioRow(o.value, rekordboxUse, setRekordboxUse, o.label),
              )}
            </div>
          </div>

          {!notRekordbox && rekordboxUse !== null && (
            <>
              {/* Q2 Platform */}
              <div className="space-y-2">
                {label("Which platform?")}
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((o) => {
                    const selected = platform === o.value;
                    return (
                      <button
                        type="button"
                        key={o.value}
                        onClick={() => setPlatform(selected ? null : o.value)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q3 Cull method */}
              <div className="space-y-2">
                {label("How do you clean up your library today?")}
                <div className="space-y-1.5">
                  {CULL_OPTIONS.map((o) =>
                    radioRow(o.value, cullMethod, setCullMethod, o.label),
                  )}
                </div>
              </div>

              {/* Q4 Features */}
              <div className="space-y-2">
                {label("Which of these would actually change your workflow?")}
                <div className="flex flex-wrap gap-2">
                  {FEATURE_OPTIONS.map((o) =>
                    checkChip(featuresWanted, setFeaturesWanted, o.value, o.label),
                  )}
                </div>
              </div>

              {/* Q5 Hesitations */}
              <div className="space-y-2">
                {label("Biggest hesitation about a tool that edits your library?")}
                <div className="flex flex-wrap gap-2">
                  {HESITATION_OPTIONS.map((o) =>
                    checkChip(editHesitations, setEditHesitations, o.value, o.label),
                  )}
                </div>
              </div>

              {/* Q6 Trust */}
              <div className="space-y-2">
                {label("Trust writing straight to Rekordbox if it auto-backs-up first and never runs while Rekordbox is open?")}
                <div className="flex flex-wrap gap-2">
                  {TRUST_OPTIONS.map((o) => {
                    const selected = trustDirectWrite === o.value;
                    return (
                      <button
                        type="button"
                        key={o.value}
                        onClick={() => setTrustDirectWrite(selected ? null : o.value)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q7 Interest */}
              <div className="space-y-2">
                {label(`Interest in ${SONGSWIPE_NAME}?`, true)}
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((o) => {
                    const selected = interest === o.value;
                    return (
                      <button
                        type="button"
                        key={o.value}
                        onClick={() => setInterest(o.value)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q8 + Q9 Beta + email */}
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wantsBeta}
                    onChange={(e) => setWantsBeta(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">
                    Email me when the beta opens
                  </span>
                </label>
                {wantsBeta && (
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className={`w-full px-3 py-2 rounded-lg text-sm border-2 bg-background text-foreground focus:outline-none transition-colors ${
                        email && !isValidEmail(email)
                          ? "border-destructive focus:border-destructive"
                          : "border-border focus:border-primary"
                      }`}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Only used to invite you to the {SONGSWIPE_NAME} beta. No spam.
                    </p>
                  </div>
                )}
              </div>

              {/* Q10 Call */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsCall}
                  onChange={(e) => setWantsCall(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  I&apos;d do a quick 20-min call about my workflow
                </span>
              </label>
            </>
          )}

          {/* Q11 Suggestions — always shown */}
          <div className="space-y-2">
            {label("Any feature ideas for SC Toolkit or " + SONGSWIPE_NAME + "?")}
            <textarea
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Anything you wish either tool did…"
              className="w-full px-3 py-2 rounded-lg text-sm border-2 border-border bg-background text-foreground focus:border-primary focus:outline-none resize-none"
            />
          </div>

          {/* Q12 Name idea */}
          {!notRekordbox && rekordboxUse !== null && (
            <div className="space-y-2">
              {label("Name ideas?")}
              <input
                type="text"
                value={nameIdea}
                onChange={(e) => setNameIdea(e.target.value)}
                maxLength={120}
                placeholder="We're toying with 'TrackToolkit' — what would you call it?"
                className="w-full px-3 py-2 rounded-lg text-sm border-2 border-border bg-background text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          )}

          {errorMessage && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {errorMessage}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
              {submitting ? "Sending…" : "Submit"}
            </Button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSnooze}
                disabled={submitting}
                className="flex-1 text-xs font-medium text-muted-foreground hover:text-foreground py-1.5 transition-colors disabled:opacity-50"
              >
                Ask me later
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                type="button"
                onClick={onDontShowAgain}
                disabled={submitting}
                className="flex-1 text-xs font-medium text-muted-foreground hover:text-foreground py-1.5 transition-colors disabled:opacity-50"
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
