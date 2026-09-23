"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The hover pairs `bg-accent` with `--accent-foreground`, not
 * `--primary-text`: the brand orange on `--accent` measures 4.21:1 light and
 * 3.75:1 dark, and a link's hover state is still text, so it has to clear AA.
 * `--accent-foreground` is the token paired with `bg-accent` everywhere else
 * in the system (Button and IconButton, ghost and outline).
 */
export function ExportBackLink() {
  return (
    <Link
      href="/export"
      className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to Export
    </Link>
  );
}
