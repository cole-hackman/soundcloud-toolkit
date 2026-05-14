"use client";

import { cn } from "@/lib/utils";

interface ProgressiveBlurProps {
  children: React.ReactNode;
  className?: string;
  /** Height of the fade zone in px. Default 80 */
  fadeHeight?: number;
  /** Whether to show the fade. Set false when list is short enough to not scroll. */
  active?: boolean;
}

/**
 * Wraps a scrollable list and adds a bottom fade-to-blur overlay
 * to signal there's more content below — cleaner than a hard cutoff.
 */
export function ProgressiveBlur({
  children,
  className,
  fadeHeight = 80,
  active = true,
}: ProgressiveBlurProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-10"
          style={{
            height: fadeHeight,
            background:
              "linear-gradient(to bottom, transparent, var(--color-surface, hsl(var(--background))))",
          }}
        />
      )}
    </div>
  );
}
