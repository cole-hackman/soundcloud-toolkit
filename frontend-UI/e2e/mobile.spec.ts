import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

interface PageCase {
  path: string;
  needsMock?: boolean;
  /** Set when the page is known to overflow today; names the phase that fixes it. */
  fixme?: string;
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
  { path: "/following-manager/", needsMock: true },
  { path: "/repost-manager/", needsMock: true },
  { path: "/combine/", needsMock: true },
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

for (const { path, needsMock, fixme } of PAGES) {
  test(`no horizontal overflow: ${path}`, async ({ page }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");
    test.fixme(!!fixme, fixme);

    if (needsMock) {
      await mockApi(page);
    }

    await page.goto(path);

    // Measure the route's own content, not the shell's spinner. `AppLayout`
    // renders a hydration/auth placeholder first, and it is narrow enough to
    // never overflow — so a measurement taken before the page mounts reports
    // on the placeholder and passes regardless of what the page does. Same
    // failure mode the a11y spec has, and the same guard: every `(app)` route
    // renders an `<h1>` through `PageHeader`.
    if (needsMock) {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
