import { test, expect } from "@playwright/test";
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
 * So the shape these tests send is an object where a list belongs. That is
 * what a back end returns after someone wraps a collection one level deeper,
 * or what an error page yields when it is still content-typed JSON — the
 * realistic ways a list stops being a list. `asArray` (src/lib/api-shape.ts)
 * checks `Array.isArray` before believing any of it.
 *
 * The assertions are deliberately about survival, not content. An uncaught
 * render error unmounts React's whole tree, so "the `h1` is still on screen
 * and nothing threw" is precisely the difference between the empty state and
 * the blank screen. Asserting the empty state's wording instead would couple
 * this to copy that is allowed to change.
 */

interface DegradedCase {
  /** Route under test. */
  path: string;
  /** `/api/**` paths whose list payload is replaced with a non-array. */
  endpoints: string[];
  /** The key the page reads the list out of. */
  key?: "collection" | "tracks";
}

const CASES: DegradedCase[] = [
  { path: "/combine/", endpoints: ["/api/playlists"] },
  { path: "/likes-to-playlist/", endpoints: ["/api/likes/paged", "/api/playlists"] },
  { path: "/playlist-compare/", endpoints: ["/api/playlists"] },
  { path: "/recently-played/", endpoints: ["/api/recently-played", "/api/playlists"] },
  { path: "/activity-to-playlist/", endpoints: ["/api/activities", "/api/playlists"] },
  { path: "/playlist-health-check/", endpoints: ["/api/playlists"] },
  { path: "/playlist-modifier/", endpoints: ["/api/playlists"] },
  { path: "/downloads/", endpoints: ["/api/playlists"] },
  { path: "/genre-search/", endpoints: ["/api/playlists"] },
  { path: "/following-library/", endpoints: ["/api/followings"] },
  { path: "/playlist-to-likes/", endpoints: ["/api/playlists"] },
];

for (const { path, endpoints, key = "collection" } of CASES) {
  test(`survives a non-array ${key} without crashing: ${path}`, async ({ page }) => {
    await mockApi(page);

    // Registered after mockApi, so Playwright runs it first and these
    // endpoints answer with a list-shaped key that is not a list.
    for (const endpoint of endpoints) {
      await page.route(`**${endpoint}*`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          // An object where the array belongs, plus a plausible `total`, so
          // the only thing wrong with the payload is the one thing under test.
          body: JSON.stringify({ [key]: { 0: "not", 1: "an array" }, total: 0 }),
        }),
      );
    }

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(path);

    // React tears the tree down on an uncaught render error, so a heading that
    // is still on screen after the payload has been consumed is the assertion
    // that a crash would fail.
    await expect(page.locator("main#main-content")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    expect(errors, `uncaught page errors on ${path}`).toEqual([]);
  });
}
