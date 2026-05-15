"use client";

import { Repeat2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";
import { ExportBackLink } from "@/components/export/ExportBackLink";
import { ListExportCard } from "@/components/export/ListExportCard";
import { apiFetch } from "@/lib/api";
import { REPOST_FORMATS } from "@/lib/export-config";
import type { ExportRepost } from "@/lib/export";

export default function ExportRepostsPage() {
  const loadReposts = async (): Promise<ExportRepost[]> => {
    const response = await apiFetch("/api/reposts");
    if (!response.ok) throw new Error("Failed to fetch reposts");
    const data = await response.json();
    return data.collection || [];
  };

  return (
    <PageContainer maxWidth="narrow">
      <ExportBackLink />
      <PageHeader
        title="Export Reposts"
        description="Export reposted tracks and playlists as Title - Artist lines, URLs, or CSV."
      />
      <ListExportCard
        embedded
        icon={<Repeat2 className="h-6 w-6" />}
        title="Export Reposts"
        subtitle=""
        description=""
        fetchLabel="Load reposts"
        filenamePrefix="soundcloud-reposts"
        formats={REPOST_FORMATS}
        emptyTitle="No reposts to export"
        emptyDescription="Repost tracks or playlists on SoundCloud to see them here."
        emptyLinkHref="/repost-manager"
        emptyLinkLabel="Open Repost Manager"
        loadItems={loadReposts}
      />
    </PageContainer>
  );
}
