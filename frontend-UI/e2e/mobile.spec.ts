import { test, expect, type Locator, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

interface PageCase {
  path: string;
  needsMock?: boolean;
  /** Set when the page is known to overflow today; names the phase that fixes it. */
  fixme?: string;
  /**
   * Drive the page into the state worth measuring and return something that
   * only exists once the route's own content is on screen. Without it a page
   * can be measured while it is still the shell's spinner or an empty state,
   * and the widest thing on it — a toolbar, a table, a row of badges — is
   * never in the document when `scrollWidth` is read. Mirrors the same hook
   * in `a11y.spec.ts`.
   */
  ready?: (page: Page) => Promise<Locator>;
}

/** The page's own `<h1>`, which every `(app)` route renders via `PageHeader`. */
const h1 = async (page: Page) => page.getByRole("heading", { level: 1 });

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
    path: "/playlist-keyword-search/",
    needsMock: true,
    // The "no search yet" empty state is not what this page is: the toolbar,
    // the match rows and their badges only exist after a search, so run one.
    ready: async (page) => {
      await page.getByLabel("Keywords").fill("sample");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      return page.getByRole("heading", { name: "Matches" });
    },
  },
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

    if (needsMock) {
      await expect(await (ready ?? h1)(page)).toBeVisible();
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

test("dashboard tap targets are at least 24x24: /dashboard/", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/dashboard/");
  await assertTapTargets(page, "main a, main button", 24);
});
