import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

/**
 * A degraded API response must render an empty page, not a blank one.
 *
 * Every tool page reads a list out of a query payload and hands it to `.map`.
 * That list used to arrive through `as unknown as T[]`, a cast which asks
 * TypeScript to vouch for an array it has never seen, so nothing in the type
 * system or the test suite stood between a bad payload and a render crash.
 * The `|| []` most call sites paired it with covers the narrow case — a `{}`
 * body leaves the key undefined — and nothing else: a `collection` that is an
 * object rather than an array is truthy, survives the fallback, reaches `.map`
 * and takes the whole route down. Two crashes on the Growth page were exactly
 * this, found in production rather than here.
 *
 * ## How this spec settles, and why it is not the usual pattern
 *
 * The first version of this file could not fail, and the way it failed to fail
 * is worth writing down because both halves are traps this suite has hit
 * before (see the REQUIRED amendments in phase6-shared.md).
 *
 *  1. It waited for a level-1 heading. Every route with a `loading.tsx`
 *     renders that file's own `PageHeader`, so the `h1` is on screen while the
 *     skeleton is up — the assertion resolved against the skeleton and the
 *     test finished before the payload had even been consumed.
 *  2. It listened for `pageerror`. `AppLayout` wraps every route in
 *     react-error-boundary, and a production React build reports a *caught*
 *     render error through `console.error`, not as an uncaught exception. The
 *     listener could never fire, on a crash or on a success.
 *
 * The usual fix — await the route's `READY` locator — does not work here
 * either, because `READY` names real content and the whole point of this spec
 * is that there is none. So the settle is: wait for every degraded response to
 * be delivered, then for the route's loading region to go away. At that point
 * the page has either rendered its empty state or thrown, and the three
 * assertions below tell those apart:
 *
 *  - the error boundary's own text is absent,
 *  - an `h1` is still on screen (the boundary replaces the tree that had one),
 *  - and nothing was logged to `console.error` — which is where React reports
 *    a caught render error, and therefore the signal that actually fires.
 *
 * ## All ten routes below were verified to crash without the guard
 *
 * Measured in a scratch copy with every `asArray` call rewritten back to its
 * `(… || []) as unknown as T[]` form and rebuilt: all ten fail, every one of
 * them on the error-boundary assertion. So this file is not a mixture of real
 * hazards and decoration — each case is load-bearing for the route it names.
 * Re-do that measurement rather than trusting this paragraph if the guard is
 * ever changed.
 */

/** Rendered by `AppErrorFallback` when the boundary catches. */
const BOUNDARY_TEXT = "Something went wrong";

interface DegradedCase {
  /** Route under test. */
  path: string;
  /** `/api/**` paths whose list payload is replaced with a non-array. */
  endpoints: string[];
  /** The key the page reads the list out of. */
  key?: "collection" | "tracks";
}

const CASES: DegradedCase[] = [
  // Endpoints are the ones each route actually fetches ON MOUNT, measured
  // rather than assumed — an earlier list named `/api/likes/paged` for
  // likes-to-playlist (it fetches `/api/likes`) and `/api/playlists` for
  // three routes that do not touch it until something is clicked, and the
  // `waitForResponse` below simply hung on those.
  { path: "/combine/", endpoints: ["/api/playlists"] },
  { path: "/likes-to-playlist/", endpoints: ["/api/likes"] },
  { path: "/playlist-compare/", endpoints: ["/api/playlists"] },
  { path: "/recently-played/", endpoints: ["/api/recently-played"] },
  { path: "/activity-to-playlist/", endpoints: ["/api/activities"] },
  { path: "/playlist-health-check/", endpoints: ["/api/playlists"] },
  { path: "/playlist-modifier/", endpoints: ["/api/playlists"] },
  { path: "/downloads/", endpoints: ["/api/playlists"] },
  { path: "/following-library/", endpoints: ["/api/followings"] },
  { path: "/playlist-to-likes/", endpoints: ["/api/playlists"] },
  // `/genre-search/` is deliberately absent: it fetches no list on mount
  // (only `/api/auth/me`), so there is no payload to degrade until the
  // add-to-playlist dialog is opened. Listing it would have been a test that
  // degraded an endpoint the page never asked for.
];

/**
 * An object where the array belongs, plus a plausible `total`, so the only
 * thing wrong with the payload is the one thing under test. This is what a
 * back end returns after someone wraps a collection one level deeper — the
 * realistic way a list stops being a list while staying valid JSON.
 */
function degraded(key: string) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ [key]: { 0: "not", 1: "an array" }, total: 0 }),
  };
}

async function settle(page: Page, path: string) {
  // The route's own loading region, from its `loading.tsx`. Gone once the
  // page has rendered — either its content, its empty state, or the boundary.
  await expect(
    page.getByRole("status", { name: /loading/i }),
    `${path}: loading region never went away`,
  ).toHaveCount(0);
}

for (const { path, endpoints, key = "collection" } of CASES) {
  test(`survives a non-array ${key} without crashing: ${path}`, async ({ page }) => {
    await mockApi(page);

    // Registered after mockApi, so Playwright runs it first and these
    // endpoints answer with a list-shaped key that is not a list.
    for (const endpoint of endpoints) {
      await page.route(`**${endpoint}*`, (route) => route.fulfill(degraded(key)));
    }

    // This is where a caught render error surfaces in a production build.
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    // Kept as well, for anything that escapes the boundary entirely.
    page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

    // Armed before `goto`: proof the degraded body was actually delivered, so
    // the assertions below cannot run against a page that never saw it.
    const delivered = endpoints.map((endpoint) =>
      page.waitForResponse((response) => response.url().includes(endpoint)),
    );

    await page.goto(path);
    await Promise.all(delivered);
    await settle(page, path);

    // The boundary is the direct evidence of a crash.
    await expect(
      page.getByText(BOUNDARY_TEXT),
      `${path}: the error boundary caught a render error`,
    ).toHaveCount(0);

    // And the tree that owns the h1 is the one the boundary would have
    // replaced, so a surviving h1 is the other side of the same coin.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    expect(consoleErrors, `${path}: console errors`).toEqual([]);
  });
}
