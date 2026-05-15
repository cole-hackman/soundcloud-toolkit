"use client";

import { Heart } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";
import { ExportBackLink } from "@/components/export/ExportBackLink";
import { TrackExportCard } from "@/components/export/TrackExportCard";
import { apiFetch } from "@/lib/api";
import { likesToTracks, normalizeLikesCollection } from "@/lib/export";

export default function ExportLikesPage() {
  const loadLikes = async () => {
    const response = await apiFetch("/api/likes");
    if (!response.ok) throw new Error("Failed to fetch likes");
    const data = await response.json();
    return likesToTracks(normalizeLikesCollection(data.collection || []));
  };

  return (
    <PageContainer maxWidth="narrow">
      <ExportBackLink />
      <PageHeader
        title="Export Likes"
        description="Download all liked tracks. Use Title - Artist for Lexicon, rekordbox, or LLM matching."
      />
      <TrackExportCard
        embedded
        icon={<Heart className="h-6 w-6" />}
        title="Export Likes"
        subtitle=""
        description=""
        fetchLabel="Load liked tracks"
        filenamePrefix="soundcloud-likes"
        emptyTitle="No liked tracks to export yet"
        emptyDescription="Like some tracks on SoundCloud, then come back to export them."
        emptyLinkHref="/like-manager"
        emptyLinkLabel="Open Like Manager"
        loadTracks={loadLikes}
      />
    </PageContainer>
  );
}
