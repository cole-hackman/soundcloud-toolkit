"use client";

import { Button } from "./Button";
import { downloadCsv } from "@/lib/csv";

interface BulkReviewItem {
  id: string | number;
  label: string;
  meta?: string;
}

const PREVIEW_BOX_CLASS =
  "max-h-44 space-y-1 overflow-y-auto rounded focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background";

interface BulkReviewDetailsProps {
  action: string;
  items: BulkReviewItem[];
  warning?: string;
  exportFilename?: string;
}

export function BulkReviewDetails({
  action,
  items,
  warning,
  exportFilename,
}: BulkReviewDetailsProps) {
  const previewItems = items.slice(0, 8);
  const remainingCount = Math.max(items.length - previewItems.length, 0);

  const exportItems = () => {
    const rows = [
      ["id", "label", "meta"],
      ...items.map((item) => [
        String(item.id),
        item.label,
        item.meta || "",
      ]),
    ];
    downloadCsv(exportFilename || "selected-items.csv", rows);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-border dark:bg-secondary/20">
      <div className="mb-2 text-sm font-semibold text-foreground">
        Review before {action}
      </div>
      {warning && (
        <p className="mb-3 text-sm text-muted-foreground">
          {warning}
        </p>
      )}
      {/* `tabIndex={0}` because this box scrolls: eight preview lines do not
          fit `max-h-44`, and a scrollable region that nothing can focus is
          unreachable from the keyboard (WCAG 2.1.1, axe
          `scrollable-region-focusable`, serious). This is the confirm step
          before a destructive bulk action on eight pages, so anything past
          the fourth row was previously unreadable without a mouse. Same shape
          of fix as the export preview boxes in `components/export/`: a group
          role, an accessible name, and a visible focus ring — it is the one
          non-interactive element that has to be focusable, which is what the
          rule exemption below is for. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div tabIndex={0} role="group" aria-label={`Items to ${action}`} className={PREVIEW_BOX_CLASS}>
        {previewItems.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="truncate font-medium text-foreground">
              {item.label}
            </div>
            {item.meta && (
              <div className="truncate text-xs text-muted-foreground dark:text-muted-foreground">
                {item.meta}
              </div>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-muted-foreground dark:text-muted-foreground">
            + {remainingCount} more item{remainingCount === 1 ? "" : "s"}
          </div>
        )}
      </div>
      {exportFilename && items.length > 0 && (
        <div className="mt-3">
          <Button nowrap variant="outline" className="h-8 px-3 py-1 text-xs" onClick={exportItems}>
            Export selection
          </Button>
        </div>
      )}
    </div>
  );
}
