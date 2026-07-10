"use client";

import { useEffect, useRef } from "react";
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
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md bg-card rounded-2xl shadow-xl border-2 border-border animate-in fade-in zoom-in-95 duration-200"
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
            <h2 className="text-lg font-bold text-foreground">
              {title}
            </h2>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground">
              {description}
            </p>
          )}

          {/* Children (e.g. item list) */}
          {children && <div className="space-y-2">{children}</div>}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              ref={cancelRef}
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
