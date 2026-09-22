import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

/**
 * The collapsed desktop rail used to widen on hover and nothing else, which
 * left it unusable from the keyboard: every label was hidden and the only way
 * to read one was to point at it. It now also widens while keyboard focus is
 * inside it — keyboard focus specifically, because a mouse click focuses a
 * <button> in Chromium too, and treating that as "expand" made the collapse
 * toggle look dead.
 *
 * Widths are the assertion because they are what "collapsed" means here —
 * `w-[56px]` versus `w-56` (224px). The labels themselves are `sr-only` when
 * collapsed, and an `sr-only` element still has a 1px box, so Playwright would
 * call it visible either way.
 */

const COLLAPSED = "56px";
const EXPANDED = "224px";

async function openDashboard(page: Page, { collapsed }: { collapsed: boolean }) {
  await mockApi(page);
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("sc-toolkit-sidebar-collapsed", value);
    } catch {
      // Private mode / blocked storage — the default (expanded) still renders.
    }
  }, String(collapsed));
  await page.goto("/dashboard/");
}

/** Tab from the top of the document until focus lands inside the rail. */
async function tabIntoSidebar(page: Page): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      return !!aside && !!document.activeElement && aside.contains(document.activeElement);
    });
    if (inside) return;
  }
  throw new Error("Tab never reached the sidebar");
}

test.describe("collapsed sidebar", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "the rail is `hidden lg:flex`");
  });

  test("expands while keyboard focus is inside it and re-collapses when focus leaves", async ({
    page,
  }) => {
    await openDashboard(page, { collapsed: true });

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("width", COLLAPSED);

    // Driven by real Tab presses rather than `element.focus()`: programmatic
    // focus does not reliably set `:focus-visible`, which is now what the rail
    // keys on, so `.focus()` would be testing a different code path.
    await tabIntoSidebar(page);
    await expect(sidebar).toHaveCSS("width", EXPANDED);

    // The brand link is the rail's first focusable and is the same element in
    // both states, so taking focus here must not have unmounted it.
    const brandLink = sidebar.getByRole("link").first();
    await expect(brandLink).toBeFocused();

    // Tabbing back out puts the rail away again.
    await page.keyboard.press("Shift+Tab");
    await expect(sidebar).toHaveCSS("width", COLLAPSED);
  });

  test("a mouse click on the collapse toggle actually collapses it", async ({ page }) => {
    await openDashboard(page, { collapsed: false });

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("width", EXPANDED);

    // Chromium focuses the button on mousedown. If the rail treated that as
    // keyboard focus it would stay expanded and the toggle would look broken.
    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    // The pointer is still over the rail, which holds it open by design.
    await expect(sidebar).toHaveCSS("width", EXPANDED);

    await page.mouse.move(900, 400);
    await expect(sidebar).toHaveCSS("width", COLLAPSED);
  });

  test("a mouse click after tabbing in still collapses it", async ({ page }) => {
    await openDashboard(page, { collapsed: false });

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("width", EXPANDED);

    // Tab in first, so the keyboard-focus flag is genuinely set...
    await tabIntoSidebar(page);

    // ...then collapse with the mouse. The blur that follows has a
    // `relatedTarget` inside the rail, so nothing clears the flag on the way
    // out; only re-reading `:focus-visible` on the incoming focus does. While
    // the flag survived, the rail stayed expanded until focus left it
    // entirely and the toggle looked dead.
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.mouse.move(900, 400);

    await expect(sidebar).toHaveCSS("width", COLLAPSED);
  });

  test("every rail control has an accessible name while collapsed", async ({ page }) => {
    await openDashboard(page, { collapsed: true });

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveCSS("width", COLLAPSED);

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
