"use client";

import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  const Icon = variant === "destructive" ? Trash2 : AlertTriangle;
  const iconBg =
    variant === "destructive"
      ? "bg-red-100 dark:bg-red-900/30"
      : "bg-orange-100 dark:bg-orange-900/30";
  const iconColor =
    variant === "destructive"
      ? "text-red-600 dark:text-red-400"
      : "text-orange-500 dark:text-orange-400";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-card rounded-2xl shadow-xl border-2 border-gray-200 dark:border-border animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
            >
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <h2 className="text-lg font-bold text-[#333333] dark:text-foreground">
              {title}
            </h2>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-[#666666] dark:text-muted-foreground">
              {description}
            </p>
          )}

          {/* Children (e.g. item list) */}
          {children && <div className="space-y-2">{children}</div>}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={onConfirm}
              className="flex-1"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
