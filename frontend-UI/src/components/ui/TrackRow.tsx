"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackRowTrack {
  id: number | string;
  title: string;
  artwork_url?: string | null;
  user?: { username?: string | null };
  subtitle?: React.ReactNode;
  artworkAlt?: string;
}

interface TrackRowProps extends React.HTMLAttributes<HTMLDivElement> {
  track: TrackRowTrack;
  isSelected: boolean;
  onToggle: () => void;
  rightSlot?: React.ReactNode;
}

export function TrackRow({
  track,
  isSelected,
  onToggle,
  rightSlot,
  className,
  ...props
}: TrackRowProps) {
  const subtitle = track.subtitle ?? track.user?.username;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "flex h-16 items-center gap-3 rounded-xl border border-transparent bg-gray-50 px-3 text-left transition-all",
        "dark:bg-secondary/20 dark:hover:border-border",
        isSelected
          ? "border-orange-200 bg-orange-50 border-l-2 border-l-[#FF5500] dark:border-orange-900/40 dark:bg-orange-950/20"
          : "hover:border-gray-200",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          isSelected
            ? "border-[#FF5500] bg-[#FF5500] text-white"
            : "border-gray-300 bg-white text-transparent dark:border-border dark:bg-secondary",
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </div>

      <img
        src={track.artwork_url || "/SC Toolkit Icon.png"}
        alt={track.artworkAlt || track.title}
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#333333] dark:text-foreground">
          {track.title}
        </div>
        {subtitle ? (
          <div className="truncate text-xs text-[#666666] dark:text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>

      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
    </div>
  );
}
