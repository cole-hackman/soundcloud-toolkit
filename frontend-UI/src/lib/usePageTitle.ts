"use client";

import { useEffect } from "react";
import { PRODUCT_NAME } from "@/lib/rebrand";

/**
 * Sets `document.title` for a client-rendered tool page.
 *
 * Only the root layout can export `metadata` under `output: 'export'`, so
 * every page in the app group otherwise shares one title — which makes tabs,
 * bookmarks and browser history indistinguishable, and means a screen reader
 * announces the same name for every navigation.
 *
 * The previous title is restored on unmount so a page that renders this
 * conditionally cannot leave a stale name behind.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${PRODUCT_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
