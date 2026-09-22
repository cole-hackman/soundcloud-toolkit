"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ExportBackLink() {
  return (
    <Link
      href="/export"
      className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-primary-text"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to Export
    </Link>
  );
}
