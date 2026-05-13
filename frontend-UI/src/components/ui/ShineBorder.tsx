"use client";

import { cn } from "@/lib/utils";

interface ShineBorderProps {
  children: React.ReactNode;
  className?: string;
  /** The color of the traveling shine. Defaults to SC orange. */
  color?: string;
  /** Border radius in px. */
  borderRadius?: number;
  /** Width of the shine border in px. */
  borderWidth?: number;
  /** Duration of one full revolution. */
  duration?: number;
}

/**
 * Wraps children with an animated conic-gradient border that travels around
 * the card perimeter on hover. At rest the border is invisible.
 */
export function ShineBorder({
  children,
  className,
  color = "#FF5500",
  borderRadius = 12,
  borderWidth = 1,
  duration = 14,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--shine-color": color,
          "--border-radius": `${borderRadius}px`,
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
        } as React.CSSProperties
      }
      className={cn("group relative w-full", className)}
    >
      {/* Animated shine border — only visible on hover */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[var(--border-radius)]",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-500",
          "before:absolute before:inset-[-1px] before:rounded-[calc(var(--border-radius)+1px)]",
          "before:bg-[conic-gradient(from_var(--shine-angle,0deg),transparent_75%,var(--shine-color)_85%,transparent_90%)]",
          "before:[animation:shine-spin_var(--duration)_linear_infinite]",
          // Mask to only show the 1px border strip
          "before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]",
          "before:[mask-composite:xor] before:p-[var(--border-width)]"
        )}
      />
      {children}
    </div>
  );
}
