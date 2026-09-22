import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  children: React.ReactNode;
  /** `h2` under a PageHeader's `h1`; `h3` when nested a level deeper. */
  as?: "h2" | "h3";
  /** Right-aligned controls for the section. */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * A real heading for a block that currently labels itself with a styled
 * `<div>` or `<span>`. Small on purpose — the point is the element, not the
 * type scale, so a screen reader's heading list matches the page's visible
 * structure.
 */
export function SectionHeading({
  children,
  as: Tag = "h2",
  actions,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <Tag className="text-sm font-semibold text-foreground">{children}</Tag>
      {actions}
    </div>
  );
}
