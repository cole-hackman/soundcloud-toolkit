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
 *
 * The bottom padding clears the home indicator on a notched phone. Pages
 * with a selection banner override it with `pb-28`; `cn` is tailwind-merge,
 * so the later class wins.
 */
export function PageContainer({
  children,
  maxWidth = "wide",
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto px-4 sm:px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        WIDTH_MAP[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}
