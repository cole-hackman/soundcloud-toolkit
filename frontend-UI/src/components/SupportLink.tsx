"use client";

import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";

interface SupportLinkProps {
  subject?: string;
  body?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * A `mailto:` link to the shared support address. Defaults to showing the
 * address itself; pass `children` to show different text (e.g. "contact us").
 */
export function SupportLink({ subject, body, children, className }: SupportLinkProps) {
  return (
    <a
      href={supportMailto(subject ?? "Track Toolkit support", body)}
      className={
        className ??
        "underline underline-offset-2 transition hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
      }
    >
      {children ?? SUPPORT_EMAIL}
    </a>
  );
}

export default SupportLink;
