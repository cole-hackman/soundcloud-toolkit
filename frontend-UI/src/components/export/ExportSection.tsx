"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui";

interface ExportSectionProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  description: string;
  children: ReactNode;
}

export function ExportSection({
  icon,
  title,
  subtitle,
  description,
  children,
}: ExportSectionProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10"
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children}
    </Card>
  );
}
