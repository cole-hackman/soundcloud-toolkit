"use client";

import { cn } from "@/lib/utils";

interface PulsatingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /** Color of the pulse ring. Defaults to SC orange. */
  pulseColor?: string;
  /** Duration of one pulse cycle. Default 1.5s */
  duration?: string;
}

/**
 * A button with an expanding ring pulse animation.
 * Ideal for destructive or high-stakes CTAs (unlike, unfollow, remove).
 */
export function PulsatingButton({
  children,
  className,
  pulseColor = "#FF5500",
  duration = "1.5s",
  ...props
}: PulsatingButtonProps) {
  return (
    <button
      {...props}
      style={
        {
          "--pulse-color": pulseColor,
          "--duration": duration,
        } as React.CSSProperties
      }
      className={cn(
        // Base button styles — matches the existing destructive variant look
        "relative inline-flex cursor-pointer items-center justify-center rounded-lg",
        "bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm",
        "transition-all hover:bg-red-600 hover:-translate-y-0.5 hover:shadow-md",
        "disabled:pointer-events-none disabled:opacity-50",
        // Pulse ring
        "before:absolute before:inset-0 before:rounded-lg",
        "before:animate-[pulse-ring_var(--duration)_ease-out_infinite]",
        "before:border-2 before:border-[var(--pulse-color)]",
        "before:opacity-0",
        className
      )}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
