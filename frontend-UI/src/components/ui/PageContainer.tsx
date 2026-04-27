import { cn } from "@/lib/utils";

const WIDTH_MAP = {
  narrow: "max-w-4xl",   // form / result pages (resolver, cloner)
  default: "max-w-5xl",  // dashboard, downloads, genre search
  wide: "max-w-6xl",     // list-heavy & two-column pages
} as const;

interface PageContainerProps {
  children: React.ReactNode;
  /** Controls the max-width of the centred content column. */
  maxWidth?: keyof typeof WIDTH_MAP;
  className?: string;
}

/**
 * Shared page wrapper that replaces per-page boilerplate
 * (`min-h-screen`, background, container, padding).
 *
 * Background & min-height are handled by AppShell — this component
 * only provides horizontal centering, max-width, and consistent padding.
 */
export function PageContainer({
  children,
  maxWidth = "wide",
  className,
}: PageContainerProps) {
  return (
    <div className={cn("mx-auto px-4 sm:px-6 py-6", WIDTH_MAP[maxWidth], className)}>
      {children}
    </div>
  );
}
