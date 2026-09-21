"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, EmptyState } from "@/components/ui";
import { SupportLink } from "@/components/SupportLink";

/**
 * Fallback for the app-wide `ErrorBoundary` in `AppLayout`.
 *
 * Reads its own `usePathname()` rather than taking one as a prop — it's
 * rendered by react-error-boundary in place of the tree that threw, but it's
 * still mounted inside the same route, so the router context is intact and
 * this always reflects the page the error happened on.
 */
export function AppErrorFallback() {
  const pathname = usePathname();
  const feedbackHref = `/feedback/?type=bug&from=${encodeURIComponent(pathname ?? "")}`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <EmptyState
        title="Something went wrong"
        description="This page hit an unexpected error. Reloading usually fixes it."
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="default"
                onClick={() => window.location.reload()}
              >
                Reload
              </Button>
              <Link
                href={feedbackHref}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-sm transition hover:border-primary/40 hover:bg-secondary/80"
              >
                Report this
              </Link>
            </div>
            <span className="text-xs text-muted-foreground">
              Still stuck? <SupportLink subject="Track Toolkit support">Email us</SupportLink>
            </span>
          </div>
        }
      />
    </div>
  );
}

export default AppErrorFallback;
