"use client";

import { Users } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";
import { ExportBackLink } from "@/components/export/ExportBackLink";
import { ListExportCard } from "@/components/export/ListExportCard";
import { apiFetch } from "@/lib/api";
import { FOLLOWING_FORMATS } from "@/lib/export-config";
import type { ExportFollowing } from "@/lib/export";

export default function ExportFollowingsPage() {
  const loadFollowings = async (): Promise<ExportFollowing[]> => {
    const response = await apiFetch("/api/followings");
    if (!response.ok) throw new Error("Failed to fetch followings");
    const data = await response.json();
    return data.collection || [];
  };

  return (
    <PageContainer maxWidth="narrow">
      <ExportBackLink />
      <PageHeader
        title="Export Followings"
        description="Export everyone you follow as a simple list or spreadsheet."
      />
      <ListExportCard
        embedded
        icon={<Users className="h-6 w-6" />}
        title="Export Followings"
        subtitle=""
        description=""
        fetchLabel="Load followings"
        filenamePrefix="soundcloud-followings"
        formats={FOLLOWING_FORMATS}
        emptyTitle="You're not following anyone yet"
        emptyDescription="Follow artists on SoundCloud to export your list here."
        emptyLinkHref="/following-manager"
        emptyLinkLabel="Open Following Manager"
        loadItems={loadFollowings}
      />
    </PageContainer>
  );
}
