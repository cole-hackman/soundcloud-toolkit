"use client";

import { cn } from "@/lib/utils";

interface AnimatedShinyTextProps {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
}

/**
 * A badge/label whose text has a traveling shimmer sweep.
 * Uses background-clip: text with an animated linear-gradient.
 */
export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 100,
}: AnimatedShinyTextProps) {
  return (
    <span
      style={{ "--shimmer-width": `${shimmerWidth}px` } as React.CSSProperties}
      className={cn(
        // Base — fall back to a neutral muted color
        "inline-flex items-center text-muted-foreground",
        // Shimmer sweep via background-clip: text
        "animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shimmer-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
        "bg-gradient-to-r from-transparent via-white/80 via-50% to-transparent dark:via-black/80",
        className
      )}
    >
      {children}
    </span>
  );
}
