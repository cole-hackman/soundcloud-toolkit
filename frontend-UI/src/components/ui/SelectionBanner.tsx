"use client";

import { Button } from "./Button";

interface SelectionBannerProps {
  count: number;
  actionLabel: string;
  onAction: () => void;
  actionVariant?: "default" | "destructive";
  disabled?: boolean;
  actionIcon?: React.ReactNode;
}

export function SelectionBanner({
  count,
  actionLabel,
  onAction,
  actionVariant = "default",
  disabled = false,
  actionIcon,
}: SelectionBannerProps) {
  if (count <= 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-white/95 backdrop-blur dark:bg-background/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span className="text-sm font-semibold text-[#FF5500]">
          {count} track{count === 1 ? "" : "s"} selected
        </span>
        <Button
          variant={actionVariant}
          className="h-10 px-4"
          onClick={onAction}
          disabled={disabled}
        >
          {actionIcon}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
