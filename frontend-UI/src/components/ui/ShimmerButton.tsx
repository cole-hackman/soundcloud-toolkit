import { cn } from "@/lib/utils";
import React from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
  /** Render as an anchor tag instead of button (pass href) */
  as?: "button" | "a";
  href?: string;
}

export function ShimmerButton({
  shimmerColor = "#ffffff",
  shimmerSize = "0.05em",
  borderRadius = "8px",
  shimmerDuration = "3s",
  background = "rgba(255, 85, 0, 1)",
  className,
  children,
  as = "button",
  href,
  ...props
}: ShimmerButtonProps) {
  const style = {
    "--shimmer-color": shimmerColor,
    "--shimmer-size": shimmerSize,
    "--border-radius": borderRadius,
    "--shimmer-duration": shimmerDuration,
    "--background": background,
    "--spread": "90deg",
    "--cut": shimmerSize,
  } as React.CSSProperties;

  const classes = cn(
    "relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap px-8 py-3 text-sm font-semibold text-white transition-all duration-300",
    "shimmer-button",
    className,
  );

  if (as === "a" && href) {
    return (
      <a href={href} className={classes} style={style}>
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </a>
    );
  }

  return (
    <button className={classes} style={style} {...props}>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
