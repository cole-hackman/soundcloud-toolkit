"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Children must NOT mount during the static export prerender. Several pages
  // call useSuspenseQuery at the top level; mounting them on the server makes
  // them suspend on a fetch that can never resolve there, and `next build`
  // times out after 60s per page (dashboard, combine, like-manager and
  // following-manager all failed this way). Gating on a hydration flag keeps
  // prerender childless while still mounting eagerly in the browser.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Past hydration we mount children even while the auth check is still in
  // flight. Blocking here used to hold every child unmounted until
  // /api/auth/me resolved, so no page's react-query hooks could fire and auth
  // and data were fully serialized on every cold load; now they race. `user`
  // stays null until the check resolves, so nothing renders real account data
  // during that window, the redirect below still fires the moment we learn the
  // session is invalid, and any page query that beats it fails safe —
  // apiFetch's global 401 interceptor (src/lib/api.ts) redirects on its own.
  if (!loading && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

export default AppLayout;
