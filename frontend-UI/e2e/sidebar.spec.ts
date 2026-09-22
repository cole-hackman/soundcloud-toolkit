import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures/api";

/**
 * The collapsed desktop rail used to widen on hover and nothing else, which
 * left it unusable from the keyboard: every label was hidden and the only way
 * to read one was to point at it.
 *
 * Widths are the assertion because they are what "collapsed" means here —
 * `w-[56px]` versus `w-56` (224px). The labels themselves are `sr-only` when
 * collapsed, and an `sr-only` element still has a 1px box, so Playwright would
 * call it visible either way.
 */
test.describe("collapsed sidebar", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the rail is `hidden lg:flex`");

    await mockApi(page);
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("sc-toolkit-sidebar-collapsed", "true");
      } catch {
        // Private mode / blocked storage — the default (expanded) still renders.
      }
    });
    await page.goto("/dashboard/");
  });

  test("expands while focus is inside it and re-collapses when focus leaves", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("width", "56px");

    // The brand link is the rail's first focusable element, and it is the same
    // element in both states — so taking focus here must not unmount it.
    const brandLink = sidebar.getByRole("link").first();
    await brandLink.focus();

    await expect(sidebar).toHaveCSS("width", "224px");
    await expect(brandLink).toBeFocused();

    // Focus moving out of the rail puts it back.
    await page.locator("#main-content").focus();
    await expect(sidebar).toHaveCSS("width", "56px");
  });

  test("every rail control has an accessible name while collapsed", async ({ page }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("width", "56px");

    const nameless = await sidebar.locator("a, button").evaluateAll((elements) =>
      elements
        .filter((el) => {
          const label = el.getAttribute("aria-label");
          return !label?.trim() && !el.textContent?.trim();
        })
        .map((el) => el.outerHTML.slice(0, 120)),
    );

    expect(nameless, JSON.stringify(nameless, null, 2)).toEqual([]);
  });
});
