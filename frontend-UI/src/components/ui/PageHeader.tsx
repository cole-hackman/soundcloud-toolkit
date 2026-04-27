"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <header className={cn("mb-6", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            "mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary",
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
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
