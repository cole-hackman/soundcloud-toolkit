"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/usePageTitle";
import { hasNavigated, markNavigated } from "@/lib/navigation-state";

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
    // A fresh page load should keep whatever focus the browser gave it — and
    // so should the second PageHeader a route's own `loading.tsx` mounts for
    // the same pathname. On a client-side navigation the DOM is replaced
    // under a focus position that no longer means anything, so move focus to
    // the new page's heading — that is what tells a screen-reader user where
    // they landed, and it puts Tab back at the top of the new content.
    //
    // Marking here as well as in the app-group layout is deliberate: React
    // flushes a child's effect before its parent's, so on the first
    // navigation of a session the layout has not run yet.
    markNavigated(pathname);
    if (!hasNavigated()) return;
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
