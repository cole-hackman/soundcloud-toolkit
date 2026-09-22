import { test, expect, type Page } from "@playwright/test";
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

/**
 * `useDialog`'s Tab trap reads the panel's first and last focusable out of a
 * `querySelectorAll`, and a selector cannot tell a rendered control from one
 * inside a `hidden` block. No dialog in the app has such a block today, so the
 * hidden focusable is injected here — into the real drawer, driving the real
 * hook, rather than re-implementing the selector in the test.
 */
test.describe("useDialog focus trap", () => {
  const GHOST_ID = "e2e-ghost-focusable";

  async function openDrawerWithHiddenFocusable(page: Page) {
    await mockApi(page);
    await page.goto("/dashboard/");
    await page.locator('button[aria-label="Open menu"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.evaluate((id) => {
      const panel = document.querySelector('[role="dialog"]');
      if (!panel) throw new Error("no dialog panel");
      const block = document.createElement("div");
      block.hidden = true;
      const ghost = document.createElement("button");
      ghost.type = "button";
      ghost.id = id;
      ghost.textContent = "ghost";
      block.appendChild(ghost);
      panel.appendChild(block);
    }, GHOST_ID);
  }

  /** Where focus is, relative to the dialog, as plain data. */
  function focusState(page: Page, ghostId: string) {
    return page.evaluate((id) => {
      const panel = document.querySelector('[role="dialog"]');
      const active = document.activeElement as HTMLElement | null;
      return {
        insidePanel: !!panel && !!active && panel.contains(active),
        isGhost: active?.id === id,
        name: (active?.getAttribute("aria-label") || active?.textContent || "").trim().slice(0, 40),
      };
    }, ghostId);
  }

  test("Shift+Tab off the first control wraps to the last VISIBLE one", async ({
    page,
  }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "the drawer is a phone affordance");

    await openDrawerWithHiddenFocusable(page);

    // The dialog focuses its first focusable on open — the close button.
    const before = await focusState(page, GHOST_ID);
    expect(before.insidePanel).toBe(true);

    await page.keyboard.press("Shift+Tab");

    const after = await focusState(page, GHOST_ID);
    expect(after.insidePanel).toBe(true);
    expect(after.isGhost).toBe(false);
    // Without the fix the hidden button is the computed `last`, `.focus()` on
    // it is a no-op, and focus never leaves the close button.
    expect(after.name).not.toBe(before.name);
  });

  test("Tab off the last visible control stays inside the dialog", async ({ page }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "the drawer is a phone affordance");

    await openDrawerWithHiddenFocusable(page);

    // Park focus on the last control a sighted keyboard user can actually
    // reach, which is where the wrap is supposed to happen.
    await page.evaluate((id) => {
      const panel = document.querySelector('[role="dialog"]');
      if (!panel) throw new Error("no dialog panel");
      const visible = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.id !== id && el.checkVisibility());
      visible[visible.length - 1]?.focus();
    }, GHOST_ID);

    expect((await focusState(page, GHOST_ID)).insidePanel).toBe(true);

    await page.keyboard.press("Tab");

    // Without the fix the trap does not recognise this as the last element,
    // lets the keypress through, and focus leaves the dialog entirely.
    const after = await focusState(page, GHOST_ID);
    expect(after.insidePanel).toBe(true);
    expect(after.isGhost).toBe(false);
  });
});
