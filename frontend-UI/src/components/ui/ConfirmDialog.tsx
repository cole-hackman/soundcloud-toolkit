"use client";

import { useRef } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

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
  /**
   * Where focus goes on close. Only needed when the trigger's DOM node does
   * not survive the re-render that closes the dialog — then the element
   * remembered at open time is detached and focus would fall to the body.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * A confirm/cancel prompt. A thin wrapper over `Dialog` — the focus trap,
 * Escape handling, scroll lock and z-index all live there; what is left here
 * is the icon, the two buttons, and the choice to open on Cancel so a
 * mis-aimed Enter never confirms a destructive action.
 */
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
  returnFocusRef,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

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
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      description={description}
      initialFocusRef={cancelRef}
      returnFocusRef={returnFocusRef}
      icon={
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
        </div>
      }
      footer={
        <div className="flex gap-3 pt-1">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children ? <div className="space-y-2">{children}</div> : null}
    </Dialog>
  );
}
