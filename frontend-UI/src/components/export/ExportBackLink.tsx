"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ExportBackLink() {
  return (
    <Link
      href="/export"
      className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-[#FF5500]"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Export
    </Link>
  );
}
