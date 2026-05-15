"use client";

import { useEffect, useState } from "react";
import { Heart, ListMusic, Repeat2, Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";
import { TrackExportCard } from "@/components/export/TrackExportCard";
import { ListExportCard, type ListExportFormat } from "@/components/export/ListExportCard";
import { apiFetch } from "@/lib/api";
import {
  followingsToCsv,
  followingsToTxt,
  likesToTracks,
  normalizeLikesCollection,
  repostsToCsv,
  repostsToTxt,
  repostsToUrls,
  type ExportFollowing,
  type ExportRepost,
  type ExportTrack,
} from "@/lib/export";

interface PlaylistOption {
  id: number;
  title: string;
  track_count: number;
}

const FOLLOWING_FORMATS: ListExportFormat[] = [
  {
    id: "txt",
    label: "Display name / @username (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => followingsToTxt(items as ExportFollowing[]),
  },
  {
    id: "csv",
    label: "CSV (username, name, URL, counts)",
    extension: "csv",
    mime: "text/csv;charset=utf-8",
    build: (items) => followingsToCsv(items as ExportFollowing[]),
  },
];

const REPOST_FORMATS: ListExportFormat[] = [
  {
    id: "txt",
    label: "Title - Artist / Playlist lines (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => repostsToTxt(items as ExportRepost[], false),
  },
  {
    id: "txt-url",
    label: "Lines with URLs (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => repostsToTxt(items as ExportRepost[], true),
  },
  {
    id: "urls",
    label: "URLs only (.txt)",
    extension: "txt",
    mime: "text/plain;charset=utf-8",
    build: (items) => repostsToUrls(items as ExportRepost[]),
  },
  {
    id: "csv",
    label: "CSV (type, title, artist, URL)",
    extension: "csv",
    mime: "text/csv;charset=utf-8",
    build: (items) => repostsToCsv(items as ExportRepost[]),
  },
];

export default function ExportPage() {
  const [playlists, setPlaylists] = useState<PlaylistOption[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/playlists?limit=200");
        if (res.ok) {
          const data = await res.json();
          setPlaylists(data.collection || []);
        }
      } catch (e) {
        console.error("Failed to load playlists for export:", e);
      } finally {
        setLoadingPlaylists(false);
      }
    })();
  }, []);

  const loadLikes = async (): Promise<ExportTrack[]> => {
    const response = await apiFetch("/api/likes");
    if (!response.ok) throw new Error("Failed to fetch likes");
    const data = await response.json();
    return likesToTracks(normalizeLikesCollection(data.collection || []));
  };

  const loadPlaylistTracks = async (): Promise<ExportTrack[]> => {
    if (!selectedPlaylistId) throw new Error("Select a playlist first");
    const response = await apiFetch(`/api/playlists/${selectedPlaylistId}`);
    if (!response.ok) throw new Error("Failed to fetch playlist");
    const data = await response.json();
    return (data.tracks || []) as ExportTrack[];
  };

  const loadFollowings = async (): Promise<ExportFollowing[]> => {
    const response = await apiFetch("/api/followings");
    if (!response.ok) throw new Error("Failed to fetch followings");
    const data = await response.json();
    return data.collection || [];
  };

  const loadReposts = async (): Promise<ExportRepost[]> => {
    const response = await apiFetch("/api/reposts");
    if (!response.ok) throw new Error("Failed to fetch reposts");
    const data = await response.json();
    return data.collection || [];
  };

  return (
    <PageContainer maxWidth="narrow">
      <PageHeader
        title="Export"
        description="Download your SoundCloud data as text or CSV for DJ library matching, LLMs, and spreadsheets."
      />

      <div className="space-y-6">
        <TrackExportCard
          icon={<Heart className="h-5 w-5 text-primary" />}
          title="Export Likes"
          subtitle="All liked tracks"
          description="Fetches your full liked library. Use Title - Artist for Lexicon, rekordbox search, or LLM matching."
          fetchLabel="Load liked tracks"
          filenamePrefix="soundcloud-likes"
          emptyTitle="No liked tracks to export yet"
          emptyDescription="Like some tracks on SoundCloud, then come back to export them."
          emptyLinkHref="/like-manager"
          emptyLinkLabel="Open Like Manager"
          loadTracks={loadLikes}
        />

        <TrackExportCard
          icon={<ListMusic className="h-5 w-5 text-primary" />}
          title="Export Playlist"
          subtitle="Tracks from one of your playlists"
          description="Pick a playlist, then export its tracks in the same formats as likes."
          fetchLabel="Load playlist tracks"
          filenamePrefix="soundcloud-playlist"
          emptyTitle="This playlist has no tracks"
          emptyDescription="Choose another playlist or add tracks on SoundCloud."
          loadTracks={loadPlaylistTracks}
          fetchDisabled={!selectedPlaylistId}
          extraControls={
            <div className="mt-4">
              <label htmlFor="export-playlist" className="text-xs font-medium text-muted-foreground">
                Playlist
              </label>
              <select
                id="export-playlist"
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                disabled={loadingPlaylists}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">
                  {loadingPlaylists ? "Loading playlists…" : "Select a playlist"}
                </option>
                {playlists.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title} ({p.track_count} tracks)
                  </option>
                ))}
              </select>
            </div>
          }
        />

        <ListExportCard
          icon={<Users className="h-5 w-5 text-primary" />}
          title="Export Followings"
          subtitle="Accounts you follow"
          description="Export everyone you follow as a simple list or spreadsheet."
          fetchLabel="Load followings"
          filenamePrefix="soundcloud-followings"
          formats={FOLLOWING_FORMATS}
          emptyTitle="You're not following anyone yet"
          emptyDescription="Follow artists on SoundCloud to export your list here."
          emptyLinkHref="/following-manager"
          emptyLinkLabel="Open Following Manager"
          loadItems={loadFollowings}
        />

        <ListExportCard
          icon={<Repeat2 className="h-5 w-5 text-primary" />}
          title="Export Reposts"
          subtitle="Tracks and playlists you've reposted"
          description="Export reposts as Title - Artist lines, URLs, or CSV."
          fetchLabel="Load reposts"
          filenamePrefix="soundcloud-reposts"
          formats={REPOST_FORMATS}
          emptyTitle="No reposts to export"
          emptyDescription="Repost tracks or playlists on SoundCloud to see them here."
          emptyLinkHref="/repost-manager"
          emptyLinkLabel="Open Repost Manager"
          loadItems={loadReposts}
        />
      </div>
    </PageContainer>
  );
}
