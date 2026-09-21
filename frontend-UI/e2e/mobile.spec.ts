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
  { path: "/privacy/" },
  { path: "/accessibility/" },
  { path: "/login/" },
  { path: "/does-not-exist/" },
  { path: "/dashboard/", needsMock: true },
  { path: "/like-manager/", needsMock: true },
  { path: "/playlist-modifier/", needsMock: true },
  { path: "/growth/", needsMock: true },
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

    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noOverflow).toBe(true);
  });
}

test("dashboard tap targets are at least 24x24: /dashboard/", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/dashboard/");
  await assertTapTargets(page, "main a, main button", 24);
});
