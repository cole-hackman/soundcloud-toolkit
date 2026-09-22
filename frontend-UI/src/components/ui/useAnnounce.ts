"use client";

import { useCallback } from "react";

export interface AnnounceOptions {
  /** Interrupt the screen reader instead of waiting for a pause. */
  assertive?: boolean;
}

export type AnnounceListener = (message: string, assertive: boolean) => void;

/**
 * Module-level registry rather than a context, so `useAnnounce` works from
 * anywhere — including the public pages, which render outside AppShell and
 * therefore have no live region at all. There the call is a no-op instead of
 * a crash or a provider every page has to remember to add.
 *
 * A Set rather than a single slot: React 18 Strict Mode mounts effects twice
 * in development, so a second registration must not orphan the first.
 */
const listeners = new Set<AnnounceListener>();

/** Called by `LiveRegion` on mount; the returned function unregisters it. */
export function registerLiveRegion(listener: AnnounceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Imperative form, for code that is not a React component. */
export function announce(message: string, options?: AnnounceOptions): void {
  if (!message) return;
  for (const listener of listeners) {
    listener(message, options?.assertive === true);
  }
}

/**
 * Returns a stable `announce(text, { assertive })`. Writes into the app's
 * single live region so a state change that is only visible — a bulk job
 * finishing, a selection count, a page of results — is also spoken.
 */
export function useAnnounce() {
  return useCallback((message: string, options?: AnnounceOptions) => {
    announce(message, options);
  }, []);
}
