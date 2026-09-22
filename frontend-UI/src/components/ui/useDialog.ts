"use client";

import { useEffect, useRef } from "react";

/**
 * Everything the browser will hand focus to with Tab. Deliberately narrow:
 * `[tabindex="-1"]` is excluded because that is how the dialog panel itself
 * is made programmatically focusable, and it must never be a Tab stop.
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export interface UseDialogOptions {
  open: boolean;
  /** Called on Escape. The caller decides what closing means. */
  onClose: () => void;
  /** Focused on open instead of the first focusable element in the panel. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Focused on close instead of whatever was focused before opening. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * The behaviour half of a modal dialog: initial focus, a Tab trap, Escape to
 * close, a body scroll lock, and focus restored to wherever it came from.
 *
 * Returns the ref to put on the panel element — the trap and the initial
 * focus search are both scoped to that element, so it must be the node that
 * carries `role="dialog"`.
 *
 * Extracted from the three hand-rolled copies that used to live in
 * ConfirmDialog and the two announcement modals, so there is exactly one
 * implementation to keep correct.
 */
export function useDialog({
  open,
  onClose,
  initialFocusRef,
  returnFocusRef,
}: UseDialogOptions) {
  const panelRef = useRef<HTMLDivElement>(null);

  // The effect below depends on `open` alone, so that re-rendering with a new
  // inline `onClose` never tears the listener down and re-runs initial focus
  // mid-interaction. These refs keep it reading current values regardless.
  const onCloseRef = useRef(onClose);
  const initialFocusOptionRef = useRef(initialFocusRef);
  const returnFocusOptionRef = useRef(returnFocusRef);
  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusOptionRef.current = initialFocusRef;
    returnFocusOptionRef.current = returnFocusRef;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
    (initialFocusOptionRef.current?.current ?? firstFocusable ?? panel)?.focus();

    // Restore the previous value rather than clearing it, so a dialog opened
    // over an already scroll-locked surface does not unlock the page when it
    // closes. The cleanup also covers unmounting while still open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const currentPanel = panelRef.current;
      if (!currentPanel) return;

      // `aria-modal` alone does not stop Tab reaching the page behind the
      // dialog, so cycle within the panel by hand.
      const focusable = Array.from(
        currentPanel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        currentPanel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !currentPanel.contains(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (returnFocusOptionRef.current?.current ?? previouslyFocused)?.focus();
    };
  }, [open]);

  return { panelRef };
}
