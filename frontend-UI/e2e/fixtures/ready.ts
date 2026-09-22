import type { Locator, Page } from "@playwright/test";

/**
 * Per-route "the real content is on screen" locators, shared by the axe spec
 * and the overflow spec so both settle on the same thing.
 *
 * Waiting for the `h1` is necessary but not sufficient. Three ways a
 * protected route shows a heading while its own content does not exist yet:
 *
 *  - `AppLayout` renders a hydration/auth spinner first (no h1 — the h1 wait
 *    covers this one);
 *  - a route with a `loading.tsx` renders that file's own `PageHeader` while
 *    it suspends, so the h1 is the *skeleton's*;
 *  - an endpoint the fixtures do not answer leaves an `EmptyState`, which
 *    also has a heading.
 *
 * In every case an audit or a measurement taken then describes a placeholder.
 * A route listed here names something only its settled content renders.
 *
 * Add an entry when you touch a page; a route with no entry is only
 * guaranteed to have got past the spinner.
 */
export type ReadyLocator = (page: Page) => Locator;

export const READY: Record<string, ReadyLocator> = {
  // The picker grid, from `/api/playlists`.
  "/playlist-modifier/": (page) => page.getByRole("button", { name: "Sample Playlist 1" }),
  // Suspends on `/api/followings`, so the h1 alone resolves against
  // `growth/loading.tsx`'s own PageHeader while the skeleton is up.
  "/growth/": (page) => page.getByRole("checkbox", { name: "testfollowing1" }),
  // This route's settled load state is its form.
  "/link-resolver/": (page) => page.getByLabel("SoundCloud URL"),
  // The track list, from `/api/likes/paged`.
  "/likes-to-playlist/": (page) => page.getByRole("checkbox", { name: "Sample Track 1" }),
  // Opens on a playlist chooser, from `/api/playlists`.
  "/playlist-to-likes/": (page) => page.getByRole("button", { name: /Sample Playlist 1/ }),
  // The track list, from `/api/recently-played`.
  "/recently-played/": (page) => page.getByRole("checkbox", { name: "Sample Track 1" }),
  // The track list, from `/api/activities`.
  "/activity-to-playlist/": (page) => page.getByRole("checkbox", { name: "Sample Track 1" }),
  // Opens on a source chooser, from `/api/playlists`.
  "/downloads/": (page) => page.getByRole("button", { name: /Sample Playlist 1/ }),
  // `/genre-search/` is deliberately absent: its landing state is a static
  // filter form with no query behind it and no skeleton branch, so there is
  // nothing a second gate could wait for that the `h1` does not already prove.
};
