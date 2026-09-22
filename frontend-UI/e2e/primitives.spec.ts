import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures/api";

/**
 * Regressions in `src/components/ui/` — the primitives every `(app)` route
 * renders, where one defect is on forty pages at once and no single page
 * sweep could own the fix.
 *
 * Each test here is paired with a specific defect and fails without its fix,
 * which is the point: these are the failures the other gates cannot see.
 * Target size is not something axe reports, a focus trap that drops focus
 * still passes an audit of the markup, and a row that pushes the page wide
 * only does it at phone width, with text long enough to compete for room.
 */

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

test.describe("PageHeader", () => {
  test("the back link is a real target, not 20px of text", async ({ page }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "the link is `lg:hidden`");

    await mockApi(page);
    await page.goto("/like-manager/");

    const back = page.getByRole("link", { name: "Back to Dashboard" });
    await expect(back).toBeVisible();

    const box = await back.boundingBox();
    expect(box).not.toBeNull();

    // WCAG 2.5.8 sets 24px; this repo's own floor for a primary action is 44.
    // As bare inline text the link measured about 152x20 on every route.
    expect.soft(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(24);

    // It must not have grown into the heading it sits above.
    const heading = page.getByRole("heading", { level: 1 });
    const headingBox = await heading.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(headingBox!.y + 1);
  });

  test("the back link still fits the header at 360px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "m360", "the narrowest viewport is the interesting one");

    await mockApi(page);
    await page.goto("/like-manager/");

    const back = page.getByRole("link", { name: "Back to Dashboard" });
    const box = await back.boundingBox();
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);

    expect(box!.x).toBeGreaterThanOrEqual(-0.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport,
    );
  });
});
