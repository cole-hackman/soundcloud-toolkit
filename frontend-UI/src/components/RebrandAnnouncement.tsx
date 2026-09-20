"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { RebrandAnnouncementModal } from "@/components/RebrandAnnouncementModal";
import { acknowledgeRebrand, isRebrandAcknowledged } from "@/lib/rebrand";

/**
 * Shows the rebrand announcement once, to signed-in users only.
 *
 * Mounted by the protected route group's layout rather than by the dashboard,
 * so it fires on first arrival anywhere in the app — the OAuth callback lands
 * on /dashboard, but a returning user with a bookmarked tool should get the
 * news too, not silently skip it.
 */
export function RebrandAnnouncement() {
  const { isAuthenticated, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (isRebrandAcknowledged()) return;
    setOpen(true);
  }, [isAuthenticated, loading]);

  const handleAcknowledge = useCallback(() => {
    acknowledgeRebrand();
    setOpen(false);
  }, []);

  return <RebrandAnnouncementModal open={open} onAcknowledge={handleAcknowledge} />;
}

export default RebrandAnnouncement;
