"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAnnounce } from "./useAnnounce";

interface ProgressBarProps {
  value: number;
  max: number;
  /** Visible, and the bar's accessible name. */
  label: string;
  /** Extra visible context, e.g. "3 failed". */
  detail?: string;
  className?: string;
}

/** Quarters only — a bulk job that spoke every tick would be unusable. */
const ANNOUNCE_AT = [25, 50, 75, 100];

/**
 * A determinate progress bar for long bulk operations.
 *
 * The text above it is the source of truth for sighted users; the bar is
 * decoration with the ARIA values on it. Screen-reader users get the same
 * information at the quarter marks instead of on every render.
 */
export function ProgressBar({ value, max, label, detail, className }: ProgressBarProps) {
  const labelId = useId();
  const announce = useAnnounce();
  const announcedRef = useRef<Set<number>>(new Set());

  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percent = safeMax > 0 ? Math.round((safeValue / safeMax) * 100) : 0;

  useEffect(() => {
    // A restart (back to zero) re-arms every milestone.
    if (percent <= 0) {
      announcedRef.current.clear();
      return;
    }
    const crossed = ANNOUNCE_AT.filter(
      (mark) => percent >= mark && !announcedRef.current.has(mark),
    );
    if (crossed.length === 0) return;
    for (const mark of crossed) announcedRef.current.add(mark);
    announce(`${label} — ${crossed[crossed.length - 1]}% complete`);
  }, [percent, label, announce]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span id={labelId} className="font-medium text-foreground">
          {label} — {safeValue}/{safeMax}
        </span>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-2 rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
