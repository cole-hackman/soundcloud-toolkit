"use client";

import type { ReactNode } from "react";

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
    <section className="rounded-2xl border-2 border-gray-200 bg-white p-6 dark:border-border dark:bg-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
