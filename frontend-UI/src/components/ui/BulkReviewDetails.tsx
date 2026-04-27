"use client";

import { Button } from "./Button";
import { downloadCsv } from "@/lib/csv";

interface BulkReviewItem {
  id: string | number;
  label: string;
  meta?: string;
}

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
      <div className="mb-2 text-sm font-semibold text-[#333333] dark:text-foreground">
        Review before {action}
      </div>
      {warning && (
        <p className="mb-3 text-sm text-[#666666] dark:text-muted-foreground">
          {warning}
        </p>
      )}
      <div className="max-h-44 space-y-1 overflow-y-auto">
        {previewItems.map((item) => (
          <div key={item.id} className="text-sm">
            <div className="truncate font-medium text-[#333333] dark:text-foreground">
              {item.label}
            </div>
            {item.meta && (
              <div className="truncate text-xs text-[#777777] dark:text-muted-foreground">
                {item.meta}
              </div>
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-[#777777] dark:text-muted-foreground">
            + {remainingCount} more item{remainingCount === 1 ? "" : "s"}
          </div>
        )}
      </div>
      {exportFilename && items.length > 0 && (
        <div className="mt-3">
          <Button variant="outline" className="h-8 px-3 py-1 text-xs" onClick={exportItems}>
            Export selection
          </Button>
        </div>
      )}
    </div>
  );
}
