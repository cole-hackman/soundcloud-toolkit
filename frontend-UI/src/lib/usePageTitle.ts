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
 * conditionally cannot leave a stale name behind — and so `/dashboard/`,
 * which has no `PageHeader`, falls back to the root layout's title instead of
 * keeping the name of the tool you came from.
 *
 * The observer is the load-order fix. On a *fresh* load Next resolves the
 * route's metadata in a streamed chunk that commits AFTER hydration has run
 * this effect, and the `<title>` React renders there overwrites what we just
 * set — so a hard load of `/like-manager/` showed the landing page's title
 * while a client-side navigation to the same route showed the right one.
 * Watching the head and re-applying costs one string compare per head
 * mutation, and the equality guard means our own write cannot re-trigger it.
 */
export function usePageTitle(title: string): void {
  useEffect(() => {
    if (!title) return;

    const previous = document.title;
    const desired = `${title} · ${PRODUCT_NAME}`;
    const apply = () => {
      if (document.title !== desired) document.title = desired;
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      document.title = previous;
    };
  }, [title]);
}
