"use client";

import { useEffect } from "react";
import { PRODUCT_NAME } from "@/lib/rebrand";

/**
 * Sets `document.title` for a client-rendered tool page.
 *
 * A `"use client"` page cannot export `metadata`, and every page here is one.
 * The public routes get around that with a sibling **server** `layout.tsx`
 * that exports it — `about/`, `accessibility/`, `faq/`, `login/`, `privacy/`,
 * `terms/` and `admin/` each have one, and that is where a new public route's
 * title, description and canonical belong. (This is not "only the root layout
 * may export metadata", which this comment used to say and which would send
 * you to ship a route with no title and no canonical.)
 *
 * The tool pages in the `(app)` group are the exception: their shared layout
 * sets `robots: noindex`, so there is nothing for a per-route `metadata` to
 * earn — but they still need distinct *tab* titles, or bookmarks and browser
 * history are indistinguishable and a screen reader announces the same name
 * for every navigation. That is what this hook is for.
 *
 * The previous title is restored on unmount so a page that renders this
 * conditionally cannot leave a stale name behind, rather than keeping the name
 * of the tool you came from. (`/dashboard/` used to be the case that needed
 * this; it renders a `PageHeader` of its own now and is titled like the rest.)
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
