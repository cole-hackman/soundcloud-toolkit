import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi } from "./fixtures/api";

interface PageCase {
  path: string;
  /** Needs the mocked `/api/*` responses (protected app pages). */
  needsMock?: boolean;
  /** Set when the page is known to fail today; names the phase that fixes it. */
  fixme?: string;
  /** Expected HTTP status of the navigation response; defaults to 200. */
  expectedStatus?: number;
}

const PAGES: PageCase[] = [
  { path: "/" },
  { path: "/about/" },
  { path: "/faq/" },
  { path: "/terms/" },
  { path: "/privacy/" },
  { path: "/accessibility/" },
  { path: "/login/" },
  { path: "/does-not-exist/", expectedStatus: 404 },
  { path: "/dashboard/", needsMock: true },
  {
    path: "/like-manager/",
    needsMock: true,
    fixme: "Phase 6 — the sort <select> has no accessible name (select-name)",
  },
  { path: "/playlist-modifier/", needsMock: true },
  { path: "/growth/", needsMock: true },
];

for (const { path, needsMock, fixme, expectedStatus } of PAGES) {
  test(`has no serious/critical WCAG 2.2 AA violations: ${path}`, async ({ page }) => {
    test.fixme(!!fixme, fixme);

    if (needsMock) {
      await mockApi(page);
    }

    // Audit the settled page. The landing's `animate-fade-in-up` entrances
    // hold a partial opacity for ~400ms, and axe reads the blended color as a
    // contrast failure on whatever it happens to catch mid-flight. Reduced
    // motion collapses those animations to their end state via the
    // `prefers-reduced-motion` block in globals.css, which is also the state
    // an a11y audit should be measuring.
    await page.emulateMedia({ reducedMotion: "reduce" });

    const response = await page.goto(path);

    if (expectedStatus !== undefined) {
      expect(response?.status()).toBe(expectedStatus);
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

/**
 * The shared `Dialog` primitive, exercised through the one dialog that is
 * reachable from a mocked page without a write: the delete-account confirm in
 * the desktop sidebar. Covers the four things a modal has to get right —
 * it is labelled by its visible heading, Tab cannot leave it, Escape closes
 * it, and focus goes back where it came from.
 */
test("Dialog: labelled by its heading, traps Tab, Escape closes and restores focus", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "the sidebar 'Delete account' control is only rendered at lg and up",
  );

  await mockApi(page);
  await page.goto("/dashboard/");

  // Opened from the keyboard on purpose: Chromium on macOS does not focus a
  // <button> on mouse click, so a click would leave `document.body` as the
  // element to restore to and the last assertion would prove nothing.
  const trigger = page.getByRole("button", { name: "Delete account", exact: true });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // aria-labelledby must resolve to the visible h2, not to a hidden string.
  await expect(dialog).toHaveAccessibleName("Delete your account?");
  await expect(
    dialog.getByRole("heading", { level: 2, name: "Delete your account?" }),
  ).toBeVisible();

  // Opens on Cancel, so a stray Enter never confirms a destructive action.
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  // More presses than the dialog has focusable elements, so the trap has to
  // wrap at least once for this to hold.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    const focusStayedInside = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]');
      return !!panel && !!document.activeElement && panel.contains(document.activeElement);
    });
    expect(focusStayedInside, `focus escaped the dialog after ${i + 1} Tab(s)`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
