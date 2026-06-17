"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Repeat2 } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";
import { ExportBackLink } from "@/components/export/ExportBackLink";
import { ListExportCard } from "@/components/export/ListExportCard";
import { REPOST_FORMATS } from "@/lib/export-config";
import type { ExportRepost } from "@/lib/export";
import { repostsQueryOptions } from "@/lib/queries";

export default function ExportRepostsPage() {
  const queryClient = useQueryClient();
  const loadReposts = async (): Promise<ExportRepost[]> => {
    const data = await queryClient.ensureQueryData(repostsQueryOptions());
    return (data.collection || []) as unknown as ExportRepost[];
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
