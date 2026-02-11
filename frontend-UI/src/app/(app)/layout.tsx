"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { AppShell } from "@/components/AppShell";

const TOOL_SLUGS: Record<string, string> = {
  "/combine": "combine",
  "/likes-to-playlist": "likes",
  "/playlist-modifier": "modifier",
  "/link-resolver": "resolver",
  "/activity-to-playlist": "activity",
  "/like-manager": "like-manager",
  "/following-manager": "following-manager",
  "/playlist-health-check": "health-check",
  "/batch-link-resolver": "batch-resolver",
};

const LAST_TOOLS_KEY = "sc-toolkit-last-tools";
const MAX_RECENT = 3;

function updateRecentTools(pathname: string) {
  const slug = TOOL_SLUGS[pathname];
  if (!slug) return;
  try {
    const stored = localStorage.getItem(LAST_TOOLS_KEY);
    const prev: string[] = stored ? JSON.parse(stored) : [];
    const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, MAX_RECENT);
    localStorage.setItem(LAST_TOOLS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) updateRecentTools(pathname);
  }, [pathname]);

  return (
    <AppLayout>
      <AppShell>{children}</AppShell>
    </AppLayout>
  );
}
