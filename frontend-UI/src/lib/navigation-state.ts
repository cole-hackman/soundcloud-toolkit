"use client";

/**
 * Has the router moved off the route the document was loaded at?
 *
 * `PageHeader` focuses its `<h1>` on a client-side navigation and only then —
 * a fresh load must keep whatever focus the browser gave it. Deciding that
 * needs one bit of state that outlives a page, because a navigation unmounts
 * the old page and mounts a new one, so per-instance state is always "first
 * mount" and would never fire.
 *
 * It lives here rather than in `PageHeader` because nothing guarantees every
 * route in the app group renders one — `/dashboard/` did not until Task 15
 * gave it one, and a route added tomorrow need not. Hard-load a tool, go to a
 * route with no PageHeader, come back, and a PageHeader-local latch is still
 * unset while the pathname is once again the one the document loaded at — so
 * the return trip silently skipped focus. `AppGroupLayout` stays mounted
 * across every navigation and marks the flag whatever the route renders.
 */

let navigated = false;
let loadedPathname: string | null = null;

/** `/like-manager/` and `/like-manager` are the same route to us. */
export function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * The path the document itself was served at.
 *
 * Read from the Navigation Timing entry rather than captured when this module
 * happens to be evaluated. A module-scope capture is only correct while this
 * file lands in the chunk loaded with the document — a bundler decision, not
 * a guarantee — and reads the *current* location if the chunk is ever first
 * evaluated during a navigation. The timing entry is the document's own URL
 * and a History API navigation does not touch it. Memoized on first call,
 * which happens during hydration, long before any navigation.
 */
function documentPathname(): string | null {
  if (typeof window === "undefined") return null;
  if (loadedPathname !== null) return loadedPathname;

  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  let pathname = window.location.pathname;
  if (entry?.name) {
    try {
      pathname = new URL(entry.name).pathname;
    } catch {
      // Keep the location fallback.
    }
  }

  loadedPathname = normalizePathname(pathname);
  return loadedPathname;
}

/**
 * Latches once `pathname` is anything other than the route the document was
 * loaded at. Called from the app-group layout for every navigation, and from
 * `PageHeader` itself so the very first navigation does not depend on whether
 * React flushes a parent's effect before a child's (it does not).
 */
export function markNavigated(pathname: string): void {
  if (navigated || !pathname) return;
  const loaded = documentPathname();
  if (loaded === null) return;
  if (normalizePathname(pathname) !== loaded) navigated = true;
}

export function hasNavigated(): boolean {
  return navigated;
}
