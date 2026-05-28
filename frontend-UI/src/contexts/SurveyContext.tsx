"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  MonetizationSurveyModal,
  type SurveySubmission,
} from "@/components/MonetizationSurveyModal";
import {
  dashboardShownThisSession,
  isDontShowAgain,
  isSnoozed,
  isSubmittedLocal,
  isWithinGlobalCooldown,
  markDashboardShownThisSession,
  markDontShowAgain,
  markPromptedNow,
  markSubmitted,
  snooze,
} from "@/lib/survey-storage";

export type SurveyContext =
  | "dashboard"
  | "post-merge"
  | "post-from-likes";

interface MaybeShowOptions {
  context: SurveyContext;
  trackCount?: number;
}

interface SurveyApi {
  maybeShow: (opts: MaybeShowOptions) => void;
}

const SurveyContextObj = createContext<SurveyApi | null>(null);

interface ServerStatus {
  enabled: boolean;
  campaignId: string;
  submitted: boolean;
}

const HEAVY_USER_THRESHOLD = 100;

export function SurveyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<SurveyContext>("dashboard");
  const [activeTrackCount, setActiveTrackCount] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track whether we've already prompted in this React session so a quick
  // navigation between dashboard/post-op can't double-fire.
  const promptedThisRenderRef = useRef(false);

  // Fetch server status once we know who the user is.
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/feedback/survey/status");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStatus({
          enabled: !!data.enabled,
          campaignId: String(data.campaignId || ""),
          submitted: !!data.submitted,
        });
      } catch {
        // Silent — survey is non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const canShow = useCallback(
    (opts: MaybeShowOptions): boolean => {
      if (!status || !status.enabled) return false;
      if (status.submitted) return false;
      const { campaignId } = status;
      if (isSubmittedLocal(campaignId)) return false;
      if (isDontShowAgain(campaignId)) return false;
      if (isSnoozed(campaignId)) return false;

      const isHeavy =
        opts.context !== "dashboard" &&
        typeof opts.trackCount === "number" &&
        opts.trackCount >= HEAVY_USER_THRESHOLD;

      // Global 14-day cooldown — heavy-user post-op operations bypass it
      // (still respects don't-show / snooze / submitted).
      if (!isHeavy && isWithinGlobalCooldown(campaignId)) return false;

      if (opts.context === "dashboard") {
        // Dashboard is lower priority — once per session.
        if (dashboardShownThisSession()) return false;
      }

      if (promptedThisRenderRef.current && opts.context === "dashboard") {
        // Don't override a higher-priority post-op prompt with dashboard.
        return false;
      }

      return true;
    },
    [status],
  );

  const maybeShow = useCallback(
    (opts: MaybeShowOptions) => {
      if (!canShow(opts)) return;
      promptedThisRenderRef.current = true;
      setActiveContext(opts.context);
      setActiveTrackCount(opts.trackCount);
      setErrorMessage(null);
      setOpen(true);
      if (status) markPromptedNow(status.campaignId);
      if (opts.context === "dashboard") markDashboardShownThisSession();
    },
    [canShow, status],
  );

  const closeModal = useCallback(() => {
    if (submitting) return;
    setOpen(false);
  }, [submitting]);

  const handleSnooze = useCallback(() => {
    if (status) snooze(status.campaignId);
    setOpen(false);
  }, [status]);

  const handleDontShowAgain = useCallback(() => {
    if (status) markDontShowAgain(status.campaignId);
    setOpen(false);
  }, [status]);

  const handleSubmit = useCallback(
    async (data: SurveySubmission) => {
      if (!status) return;
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await apiFetch("/api/feedback/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preference: data.preference,
            lifetimeInterest: data.lifetimeInterest ?? undefined,
            comment: data.comment || undefined,
            context: activeContext,
            trackCount:
              typeof activeTrackCount === "number" ? activeTrackCount : undefined,
          }),
        });

        if (res.ok || res.status === 409) {
          markSubmitted(status.campaignId);
          setStatus((s) => (s ? { ...s, submitted: true } : s));
          setOpen(false);
        } else {
          let msg = "Couldn't submit right now. Try again?";
          try {
            const body = await res.json();
            if (body?.error) msg = body.error;
          } catch {
            // ignore
          }
          setErrorMessage(msg);
        }
      } catch {
        setErrorMessage("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [activeContext, activeTrackCount, status],
  );

  const api = useMemo<SurveyApi>(() => ({ maybeShow }), [maybeShow]);

  return (
    <SurveyContextObj.Provider value={api}>
      {children}
      <MonetizationSurveyModal
        open={open}
        context={activeContext}
        trackCount={activeTrackCount}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onSnooze={handleSnooze}
        onDontShowAgain={handleDontShowAgain}
        onClose={closeModal}
      />
    </SurveyContextObj.Provider>
  );
}

export function useSurvey(): SurveyApi {
  const ctx = useContext(SurveyContextObj);
  if (!ctx) {
    // Tolerate missing provider so triggers in unmounted contexts don't crash.
    return { maybeShow: () => {} };
  }
  return ctx;
}
