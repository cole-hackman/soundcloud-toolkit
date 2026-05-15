"use client";

import { Music } from "lucide-react";
import { EmptyState, Skeleton } from "@/components/ui";

export interface PlaylistSummary {
  id: number;
  title: string;
  track_count: number;
  artwork_url?: string;
  coverUrl?: string;
}

interface PlaylistSelectGridProps {
  playlists: PlaylistSummary[];
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
  onSelect: (playlist: PlaylistSummary) => void;
  selectedId?: number | null;
  title?: string;
  emptyDescription?: string;
}

export function PlaylistSelectGrid({
  playlists,
  loading = false,
  loadError = false,
  onRetry,
  onSelect,
  selectedId = null,
  title = "Select a playlist",
  emptyDescription = "Create some playlists on SoundCloud first.",
}: PlaylistSelectGridProps) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 dark:border-border dark:bg-card">
      <h2 className="mb-4 text-xl font-bold text-[#333333] dark:text-foreground">{title}</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-secondary/40" />
          ))}
        </div>
      ) : loadError ? (
        <EmptyState
          title="Couldn't load your playlists"
          description="The backend may be unreachable. Retry to refresh the list."
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-gradient-to-r from-[#FF5500] to-[#E64A00] px-4 py-2 text-sm font-semibold text-white transition hover:shadow-md"
              >
                Retry
              </button>
            ) : undefined
          }
        />
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={<Music className="h-12 w-12" />}
          title="No playlists found"
          description={emptyDescription}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {playlists.map((playlist) => {
            const isSelected = selectedId != null && Number(selectedId) === Number(playlist.id);
            return (
              <button
                key={playlist.id}
                type="button"
                onClick={() => onSelect(playlist)}
                className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#FF5500] bg-[#FF5500]/10"
                    : "border-transparent bg-gray-50 hover:border-[#FF5500] dark:bg-secondary/20"
                }`}
              >
                <img
                  src={playlist.coverUrl || playlist.artwork_url || "/SC Toolkit Icon.png"}
                  alt={playlist.title}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div>
                  <div className="font-semibold text-[#333333] dark:text-foreground">{playlist.title}</div>
                  <div className="text-sm text-[#666666] dark:text-muted-foreground">
                    {playlist.track_count} tracks
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
