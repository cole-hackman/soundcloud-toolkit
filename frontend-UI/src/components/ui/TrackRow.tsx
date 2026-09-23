"use client";

import { SelectableRow } from "./SelectableRow";

interface TrackRowTrack {
  id: number | string;
  title: string;
  artwork_url?: string | null;
  user?: { username?: string | null };
  subtitle?: React.ReactNode;
  artworkAlt?: string;
}

interface TrackRowProps {
  track: TrackRowTrack;
  isSelected: boolean;
  onToggle: (event?: React.MouseEvent | React.KeyboardEvent) => void;
  rightSlot?: React.ReactNode;
  /** `div` by default so an existing plain wrapper stays valid markup. */
  as?: "li" | "div";
  className?: string;
}

/**
 * A track as a selectable row: artwork, title, subtitle.
 *
 * Everything about selection lives in `SelectableRow` — this is the track's
 * presentation and nothing else. The row used to be a `div` with
 * `role="button"` and a hand-written Enter/Space handler; the checkbox is
 * keyboard-native, so that is gone.
 */
export function TrackRow({
  track,
  isSelected,
  onToggle,
  rightSlot,
  as = "div",
  className,
}: TrackRowProps) {
  const subtitle = track.subtitle ?? track.user?.username;

  return (
    <SelectableRow
      id={track.id}
      selected={isSelected}
      onToggle={onToggle}
      label={track.title}
      rightSlot={rightSlot}
      as={as}
      className={className}
    >
      <span className="flex min-w-0 items-center gap-3">
        <img
          src={track.artwork_url || "/brand/icon-192.png"}
          alt={track.artworkAlt || ""}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {track.title}
          </span>
          {subtitle ? (
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      </span>
    </SelectableRow>
  );
}
