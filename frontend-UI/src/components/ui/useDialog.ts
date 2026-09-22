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

/**
 * Is this element actually rendered?
 *
 * A selector cannot tell: `querySelectorAll` happily matches a `<button>`
 * inside a `hidden` container, and that button is not tabbable. Treating one
 * as the panel's first or last focusable loses focus outright — `.focus()` on
 * a display:none element is a no-op, so Shift+Tab off the first element goes
 * nowhere, and forward Tab off the last *visible* element is never
 * intercepted, so focus escapes the dialog to the page behind it.
 *
 * `checkVisibility` is the direct answer where it exists; `offsetParent` is
 * the fallback, with `getClientRects()` covering the `position: fixed` case
 * it reports as null.
 */
function isRendered(element: HTMLElement): boolean {
  const check = (
    element as unknown as { checkVisibility?: (options?: object) => boolean }
  ).checkVisibility;
  if (typeof check === "function") {
    return check.call(element, { visibilityProperty: true });
  }
  return !!element.offsetParent || element.getClientRects().length > 0;
}

/** Every element inside `panel` that Tab can actually reach, in DOM order. */
function focusableWithin(panel: Element): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isRendered,
  );
}

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
    const firstFocusable = panel ? (focusableWithin(panel)[0] ?? null) : null;
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
      const focusable = focusableWithin(currentPanel);
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
