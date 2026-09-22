"use client";

import * as React from "react";
import { Play, X } from "lucide-react";
import { SmallButton } from "../../primitives";

/**
 * SoundCloud's official embed widget for one track. It is an iframe on
 * w.soundcloud.com, so it needs no credentials and never touches the app's
 * token; the only prerequisite is the admin-scoped `frame-src` allowance in
 * server/middleware/security.js. Mounted on demand and one at a time —
 * each widget is a few hundred kilobytes of SoundCloud's own bundle.
 */
export const PLAYER_ORIGIN = "https://w.soundcloud.com";
const PLAYER_HEIGHT = 166;

export function playerSrc(permalinkUrl: string): string {
  const params = new URLSearchParams({
    url: permalinkUrl,
    auto_play: "false",
    visual: "false",
    show_comments: "false",
    show_user: "true",
    hide_related: "true",
    color: "#ff5500",
  });
  return `${PLAYER_ORIGIN}/player/?${params.toString()}`;
}

interface Props {
  permalinkUrl: string | null;
  title: string;
  open: boolean;
  onToggle: () => void;
}

export function TrackPlayer({ permalinkUrl, title, open, onToggle }: Props) {
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!open) setLoaded(false);
  }, [open]);

  if (!permalinkUrl) {
    return <span className="font-mono text-[11px] text-muted-foreground">No permalink yet — resolve the track first to play it.</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <SmallButton onClick={onToggle} tone={open ? "muted" : "primary"} aria-expanded={open} className="h-7">
          {open ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
          {open ? "Close player" : "Play here"}
        </SmallButton>
      </div>
      {open && (
        <div className="relative overflow-hidden rounded-lg border border-border/70 bg-muted/30" style={{ height: PLAYER_HEIGHT }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-muted-foreground" aria-hidden="true">
              Loading SoundCloud player…
            </div>
          )}
          <iframe
            title={`SoundCloud player: ${title}`}
            src={playerSrc(permalinkUrl)}
            width="100%"
            height={PLAYER_HEIGHT}
            loading="lazy"
            allow="autoplay"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoaded(true)}
            className="relative block border-0"
          />
        </div>
      )}
    </div>
  );
}
