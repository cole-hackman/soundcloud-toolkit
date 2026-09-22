import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

/**
 * The mobile drawer renders through the shared `Dialog` (`variant="drawer"`),
 * so this file is also where that primitive is exercised end to end: it is
 * labelled by its visible heading, Tab cannot leave it, Escape closes it,
 * focus goes back to the trigger, and the page behind it cannot scroll.
 */

function focusIsInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"]');
    return !!panel && !!document.activeElement && panel.contains(document.activeElement);
  });
}

const bodyOverflow = (page: Page) => page.evaluate(() => document.body.style.overflow);

test.describe("mobile drawer", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

    await mockApi(page);
    await page.goto("/dashboard/");
  });

  test("opens as a labelled dialog, takes focus, traps Tab and locks body scroll", async ({
    page,
  }) => {
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    expect(await bodyOverflow(page)).toBe("");

    await hamburger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(hamburger).toHaveAttribute("aria-expanded", "true");

    // aria-labelledby must resolve to the visible h2, not to a hidden string.
    await expect(dialog).toHaveAccessibleName("Menu");
    await expect(dialog.getByRole("heading", { level: 2, name: "Menu" })).toBeVisible();

    // The nav the hamburger's aria-controls points at is the one in here, and
    // the route you are on is marked.
    await expect(dialog.locator("nav#mobile-nav")).toHaveAttribute(
      "aria-label",
      "Main navigation",
    );
    await expect(dialog.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    expect(await focusIsInsideDialog(page), "focus did not move into the drawer").toBe(true);

    // The page behind a drawer must not scroll under it.
    expect(await bodyOverflow(page)).toBe("hidden");

    // More presses than a short dialog has focusable elements, so the trap
    // has to hold across the whole nav for this to pass.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(
        await focusIsInsideDialog(page),
        `focus escaped the drawer after ${i + 1} Tab(s)`,
      ).toBe(true);
    }
  });

  test("Escape closes it, returns focus to the hamburger and unlocks body scroll", async ({
    page,
  }) => {
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await hamburger.click();

    const closeButton = page.locator('button[aria-label="Close menu"]');
    await expect(closeButton).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(closeButton).toBeHidden();
    await expect(hamburger).toBeFocused();
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
    expect(await bodyOverflow(page)).toBe("");
  });
});
