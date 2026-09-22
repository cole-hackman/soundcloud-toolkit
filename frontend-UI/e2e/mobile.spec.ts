import { test, expect, type Locator, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

interface PageCase {
  path: string;
  needsMock?: boolean;
  /** Set when the page is known to overflow today; names the phase that fixes it. */
  fixme?: string;
  /**
   * Something only the *loaded* page renders. Same reason as in
   * `a11y.spec.ts`: skeletons render the same `PageHeader`, and a column of
   * `Skeleton`s never overflows — so without this the numbers describe the
   * app shell rather than the page.
   */
  ready?: (page: Page) => Locator;
}

const PAGES: PageCase[] = [
  { path: "/" },
  { path: "/about/" },
  { path: "/faq/" },
  { path: "/terms/" },
  { path: "/privacy/" },
  { path: "/accessibility/" },
  { path: "/login/" },
  { path: "/does-not-exist/" },
  { path: "/dashboard/", needsMock: true },
  { path: "/like-manager/", needsMock: true },
  { path: "/playlist-modifier/", needsMock: true },
  { path: "/feedback/", needsMock: true },
  {
    path: "/growth/",
    needsMock: true,
    // Measured against document.documentElement.clientWidth (fix round 1):
    // scrollWidth=468 on m360 (clientWidth 360), 469 on m390 (clientWidth
    // 390), 468 on m430 (clientWidth 430) — consistent ~468-469px overflow
    // regardless of viewport, i.e. a fixed-width element, not a percentage
    // one. See task-1-report.md fix round 1 for how this was found.
    fixme: "Phase 6 — scrollWidth ~468-469px overflows clientWidth (360/390/430px) on all three mobile widths",
  },
  {
    path: "/likes-to-playlist/",
    needsMock: true,
    ready: (page) => page.getByRole("checkbox", { name: "Sample Track 1" }),
  },
  {
    path: "/playlist-to-likes/",
    needsMock: true,
    ready: (page) => page.getByRole("button", { name: /Sample Playlist 1/ }),
  },
  {
    path: "/recently-played/",
    needsMock: true,
    ready: (page) => page.getByRole("checkbox", { name: "Sample Track 1" }),
  },
  {
    path: "/activity-to-playlist/",
    needsMock: true,
    ready: (page) => page.getByRole("checkbox", { name: "Sample Track 1" }),
  },
  // No `ready` on purpose — see the matching note in a11y.spec.ts: this page's
  // landing state is a static form with no async content to wait for.
  { path: "/genre-search/", needsMock: true },
  {
    path: "/downloads/",
    needsMock: true,
    ready: (page) => page.getByRole("button", { name: /Sample Playlist 1/ }),
  },
];

/**
 * Every element matching `selector` must have a bounding box of at least
 * min x min CSS pixels (WCAG 2.2 SC 2.5.8 Target Size, Minimum). Used for
 * mobile tap targets, where the desktop `min-h`/`min-w` utility classes may
 * not carry through.
 */
export async function assertTapTargets(page: Page, selector: string, min: number) {
  const undersized = await page.locator(selector).evaluateAll(
    (elements, minSize) =>
      elements
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
          };
        })
        .filter((box) => box.width < minSize || box.height < minSize),
    min,
  );

  expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
}

for (const { path, needsMock, fixme, ready } of PAGES) {
  test(`no horizontal overflow: ${path}`, async ({ page }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");
    test.fixme(!!fixme, fixme);

    if (needsMock) {
      await mockApi(page);
    }

    await page.goto(path);

    // Same reason as the settle wait in a11y.spec.ts: an `(app)` route shows
    // a hydration/auth spinner first, and a spinner never overflows. Measure
    // once the route's own content is mounted or the check proves nothing.
    if (needsMock) {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    if (ready) {
      await expect(ready(page).first()).toBeVisible();
    }

    // Compare against `clientWidth`, not `window.innerWidth`: on content
    // wider than the device, Chromium's mobile emulation can expand the
    // *layout* viewport (`innerWidth`) to fit it, and `scrollWidth` grows
    // right along with it — the two drift together and the check can never
    // fail. `document.documentElement.clientWidth` stays pinned to the
    // actual device width regardless, so it is the correct comparand for
    // "does this page require horizontal scrolling on a real phone."
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
      clientWidth,
    );
  });
}

/**
 * The control must be fully on screen on both edges.
 *
 * `scrollWidth` cannot see this and neither can axe: an element clipped by an
 * `overflow: hidden` ancestor contributes nothing to the document's scroll
 * width, so a button can sit entirely off the right edge while the overflow
 * check and the audit both pass. The usual cause is `truncate` on a *flex
 * container*: `white-space: nowrap` reaches the anonymous flex item holding
 * the text, whose `min-width: auto` is then its full nowrap width, so it never
 * shrinks and the `shrink-0` control beside it is pushed out and clipped.
 */
async function expectFullyOnScreen(page: Page, locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label}: no bounding box`).not.toBeNull();
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const right = box!.x + box!.width;
  expect(box!.x, `${label}: left edge at ${box!.x}`).toBeGreaterThanOrEqual(0);
  expect(right, `${label}: right edge at ${right}, viewport is ${clientWidth}`).toBeLessThanOrEqual(
    clientWidth,
  );
}

/** `document.documentElement` must not be wider than the device. */
async function expectNoOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
    clientWidth,
  );
}

/**
 * The routes that open on a chooser: the list this sweep widened, wrapped and
 * un-stickied is one interaction past the landing state, so measuring the
 * chooser alone would not see it.
 */
test("no horizontal overflow: /playlist-to-likes/ with a playlist chosen", async ({
  page,
}, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/playlist-to-likes/");
  await page.getByRole("button", { name: /Sample Playlist 1/ }).click();
  await expect(page.getByRole("checkbox", { name: "Sample Track 1" })).toBeVisible();

  await expectNoOverflow(page);
});

test("no horizontal overflow: /genre-search/ results and add-to-playlist dialog", async ({
  page,
}, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/genre-search/");
  await page.getByRole("button", { name: "house", exact: true }).click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("checkbox", { name: "Sample Track 1" }).check();

  await expectNoOverflow(page);

  await page.getByRole("button", { name: /Add to Playlist/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await expectNoOverflow(page);
});

test("no horizontal overflow: /downloads/ track list and selection mode", async ({
  page,
}, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/downloads/");
  await page.getByRole("button", { name: /Sample Playlist 1/ }).click();
  await expect(
    page.getByRole("button", { name: "Download Sample Track 1 (free download)" }),
  ).toBeVisible();

  await expectNoOverflow(page);

  await page.getByRole("button", { name: "Select to Remove" }).click();
  await expect(page.getByRole("checkbox", { name: "Sample Track 1" })).toBeVisible();

  await expectNoOverflow(page);
});

/**
 * `downloads` is the page in this batch that puts a `shrink-0` control beside
 * a truncating title, in all three of its row variants. A long title is what
 * makes a clipped control visible, and nothing else in either suite would
 * catch it.
 */
test("no clipped controls with a long title: /downloads/", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  // Registered after `mockApi`, so it wins for this one path.
  await page.route("**/api/playlists/1", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        title: "Sample Playlist 1",
        tracks: [
          {
            id: 100,
            title:
              "An extremely long sample track title that could not possibly fit across a phone screen",
            user: { username: "an-extremely-long-sample-artist-username" },
            artwork_url: null,
            duration: 200000,
            downloadable: true,
            download_url: "https://api.soundcloud.com/tracks/100/download",
            permalink_url: "https://soundcloud.com/testartist/sample-track-1",
          },
        ],
      }),
    }),
  );

  await page.goto("/downloads/");
  await page.getByRole("button", { name: /Sample Playlist 1/ }).click();

  const plainRowDownload = page.getByRole("button", { name: /^Download An extremely long/ });
  await expect(plainRowDownload).toBeVisible();
  await expectFullyOnScreen(page, plainRowDownload, "plain row download control");
  await expectNoOverflow(page);

  // Selection mode moves the same control into `rightSlot`, beside a checkbox.
  await page.getByRole("button", { name: "Select to Remove" }).click();
  const selectionRowDownload = page.getByRole("button", { name: /^Download An extremely long/ });
  await expect(selectionRowDownload).toBeVisible();
  await expectFullyOnScreen(page, selectionRowDownload, "selection row download control");
  await expectFullyOnScreen(
    page,
    page.getByRole("checkbox").first(),
    "selection row checkbox",
  );
  await expectNoOverflow(page);
});

test("dashboard tap targets are at least 24x24: /dashboard/", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/dashboard/");
  await assertTapTargets(page, "main a, main button", 24);
});
