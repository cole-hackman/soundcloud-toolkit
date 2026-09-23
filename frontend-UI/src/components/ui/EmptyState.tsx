import { cn } from "@/lib/utils";
import { SupportLink } from "@/components/SupportLink";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /**
   * The element for the title. `h3` by default — an empty state usually sits
   * under a section heading. `p` where it is not a section of the page at
   * all, so the heading outline does not gain a level that isn't there.
   */
  as?: "h2" | "h3" | "p";
  /** Appends "Need help? <support address>" under the action. */
  support?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  as: Tag = "h3",
  support = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex items-center justify-center text-muted-foreground" aria-hidden="true">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover/70">
            {icon}
          </div>
        </div>
      )}
      <Tag className="text-sm font-medium text-foreground">{title}</Tag>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
      {support && (
        <p className="mt-4 text-sm text-muted-foreground">
          Need help? <SupportLink />
        </p>
      )}
    </div>
  );
}
