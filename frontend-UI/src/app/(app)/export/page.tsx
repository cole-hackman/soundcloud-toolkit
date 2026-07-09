"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, PageContainer, PageHeader } from "@/components/ui";
import { EXPORT_FEATURES } from "@/lib/export-config";

export default function ExportHubPage() {
  return (
    <PageContainer maxWidth="narrow">
      <PageHeader
        title="Export"
        description="Download your SoundCloud data as text or CSV for DJ library matching, LLMs, and spreadsheets."
      />

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        Choose what to export
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {EXPORT_FEATURES.map((feature) => (
          <Card key={feature.id} className="group p-4 sm:p-5 hover:-translate-y-0.5">
            <Link href={feature.path} className="block">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF5500] to-[#E64A00] text-white shadow-sm">
                  <feature.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <h3 className="mb-1 text-base font-bold text-foreground transition group-hover:text-primary dark:text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                {feature.description}
              </p>
            </Link>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
