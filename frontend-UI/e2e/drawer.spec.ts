import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures/api";

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

test("mobile drawer: Escape closes it and returns focus to the hamburger", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");
  test.fixme(true, "Phase 2 — the mobile drawer does not yet close on Escape or restore focus");

  await mockApi(page);
  await page.goto("/dashboard/");

  const hamburger = page.locator('button[aria-label="Open menu"]');
  await hamburger.click();

  const closeButton = page.locator('button[aria-label="Close menu"]');
  await expect(closeButton).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(closeButton).toBeHidden();
  await expect(hamburger).toBeFocused();
});
