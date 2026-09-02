"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  RebrandSurveyModal,
  type RebrandSubmission,
} from "@/components/RebrandSurveyModal";
import { isSubmittedLocal, markSubmitted } from "@/lib/survey-storage";

export type SurveyContext =
  | "dashboard"
  | "post-merge"
  | "post-from-likes";

interface MaybeShowOptions {
  context: SurveyContext;
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

export function SurveyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<SurveyContext>("dashboard");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const canShow = useCallback((): boolean => {
    if (!status || !status.enabled) return false;
    // Server truth first, local mirror second — both mean "already voted".
    if (status.submitted) return false;
    if (isSubmittedLocal(status.campaignId)) return false;
    // Nothing else gates it. The vote is mandatory, so snooze, don't-show-again
    // and the re-prompt cooldown are all gone: honouring them would let anyone
    // who dismissed an earlier build skip the prompt permanently.
    return true;
  }, [status]);

  const maybeShow = useCallback(
    (opts: MaybeShowOptions) => {
      if (!canShow()) return;
      setActiveContext(opts.context);
      setErrorMessage(null);
      setOpen(true);
    },
    [canShow],
  );

  // Offered only after a submit has failed — see RebrandSurveyModal. This
  // closes the modal for the current page view without recording a vote, so
  // the prompt returns on the next navigation once the backend recovers.
  const handleGiveUp = useCallback(() => {
    if (submitting) return;
    setOpen(false);
  }, [submitting]);

  const handleSubmit = useCallback(
    async (data: RebrandSubmission) => {
      if (!status) return;
      setSubmitting(true);
      setErrorMessage(null);
      try {
        const res = await apiFetch("/api/feedback/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameChoice: data.nameChoice,
            nameIdea: data.nameIdea || undefined,
            featureIdea: data.featureIdea || undefined,
            context: activeContext,
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
    [activeContext, status],
  );

  const api = useMemo<SurveyApi>(() => ({ maybeShow }), [maybeShow]);

  return (
    <SurveyContextObj.Provider value={api}>
      {children}
      <RebrandSurveyModal
        open={open}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
        onGiveUp={handleGiveUp}
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
