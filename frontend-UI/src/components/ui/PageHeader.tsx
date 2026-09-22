"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/usePageTitle";

/** `/like-manager/` and `/like-manager` are the same route to us. */
function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * The route the document itself was loaded at, and whether the router has
 * since moved off it. Both are module-level on purpose: a client-side
 * navigation unmounts the old page and mounts a new one, so a per-instance
 * ref is always "first mount" and would never fire.
 *
 * Comparing against the *loaded* route rather than against "the last route a
 * PageHeader rendered for" is what makes the commonest navigation in the app
 * work: `/dashboard/` renders no PageHeader, so keyed off the latter the
 * first tool page opened from the dashboard still looked like a first mount
 * and never took focus. Once `hasNavigated` flips it stays flipped, so
 * returning to the loaded route later still moves focus, while the route's
 * own `loading.tsx` — which renders a second PageHeader for the same
 * pathname — cannot steal focus during a fresh load.
 */
const loadedPathname =
  typeof window === "undefined" ? null : normalizePathname(window.location.pathname);
let hasNavigated = false;

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
  backClassName?: string;
}

export function PageHeader({
  title,
  description,
  backHref = "/dashboard",
  backLabel = "Back to Dashboard",
  actions,
  className,
  backClassName,
}: PageHeaderProps) {
  usePageTitle(title);

  const pathname = usePathname();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // A fresh page load should keep whatever focus the browser gave it. On a
    // client-side navigation the DOM is replaced under a focus position that
    // no longer means anything, so move focus to the new page's heading —
    // that is what tells a screen-reader user where they landed, and it puts
    // Tab back at the top of the new content.
    if (!hasNavigated) {
      if (loadedPathname === null || normalizePathname(pathname) === loadedPathname) {
        return;
      }
      hasNavigated = true;
    }
    headingRef.current?.focus({ preventScroll: false });
  }, [pathname]);

  return (
    <header className={cn("mb-6", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            "mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary-text",
            "lg:hidden",
            backClassName,
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold tracking-tight text-foreground focus:outline-none md:text-3xl"
          >
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
