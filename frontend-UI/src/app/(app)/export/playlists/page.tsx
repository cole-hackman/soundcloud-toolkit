"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ListMusic } from "lucide-react";
import { Button, PageContainer, PageHeader } from "@/components/ui";
import { ExportBackLink } from "@/components/export/ExportBackLink";
import { TrackExportCard } from "@/components/export/TrackExportCard";
import {
  PlaylistSelectGrid,
  type PlaylistSummary,
} from "@/components/playlists/PlaylistSelectGrid";
import type { ExportTrack } from "@/lib/export";
import {
  playlistDetailQueryOptions,
  usePlaylistsQuery,
} from "@/lib/queries";

export default function ExportPlaylistsPage() {
  const queryClient = useQueryClient();
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistSummary | null>(null);
  const playlistsQuery = usePlaylistsQuery();
  const playlists = (playlistsQuery.data?.collection || []) as unknown as PlaylistSummary[];
  const loading = playlistsQuery.isLoading;
  const loadError = playlistsQuery.isError;

  const loadPlaylistTracks = async (): Promise<ExportTrack[]> => {
    if (!selectedPlaylist) throw new Error("Select a playlist first");
    const data = await queryClient.ensureQueryData(playlistDetailQueryOptions(selectedPlaylist.id));
    return (data.tracks || []) as unknown as ExportTrack[];
  };

  return (
    <PageContainer maxWidth="wide">
      <ExportBackLink />
      <PageHeader
        title="Export Playlist"
        description="Select a playlist, then download its tracks in your preferred format."
      />

      {!selectedPlaylist ? (
        <PlaylistSelectGrid
          playlists={playlists}
          loading={loading}
          loadError={loadError}
          onRetry={() => playlistsQuery.refetch()}
          onSelect={setSelectedPlaylist}
          title="Select a playlist to export"
          emptyDescription="Create some playlists on SoundCloud first."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
            <img
              src={selectedPlaylist.coverUrl || selectedPlaylist.artwork_url || "/SC Toolkit Icon.png"}
              alt={selectedPlaylist.title}
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{selectedPlaylist.title}</p>
              <p className="text-sm text-muted-foreground">{selectedPlaylist.track_count} tracks</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="gap-2 text-sm"
              onClick={() => setSelectedPlaylist(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Change playlist
            </Button>
          </div>

          <TrackExportCard
            embedded
            icon={<ListMusic className="h-6 w-6" />}
            title="Export Playlist"
            subtitle=""
            description=""
            fetchLabel="Load playlist tracks"
            filenamePrefix="soundcloud-playlist"
            emptyTitle="This playlist has no tracks"
            emptyDescription="Choose another playlist or add tracks on SoundCloud."
            loadTracks={loadPlaylistTracks}
          />
        </div>
      )}
    </PageContainer>
  );
}
