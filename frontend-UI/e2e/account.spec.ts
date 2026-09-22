import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi } from "./fixtures/api";

/**
 * The `/account` page: the three irreversible-ish controls a person can reach
 * about their own data, plus the retention table that explains them.
 *
 * Everything here is scoped to `<main>` on purpose. Until Task 7 lands, the
 * desktop sidebar still carries its own "Delete account" button, and an
 * unscoped role query would resolve to two elements.
 */

async function assertNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe("account page", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    // Same reasoning as a11y.spec.ts: entrance animations hold a partial
    // opacity that axe reads as a contrast failure mid-flight.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("renders the four cards and the retention table, axe clean", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();

    for (const heading of [
      "Profile",
      "Download my data",
      "Disconnect SoundCloud",
      "Delete account",
      "What we keep and for how long",
    ]) {
      await expect(main.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }

    // Profile card reads off the session payload, not a second endpoint.
    await expect(main.getByText("Test User", { exact: true })).toBeVisible();
    await expect(main.getByText("@testuser", { exact: true })).toBeVisible();
    await expect(main.getByText("SoundCloud id 1000001")).toBeVisible();

    // Row headers, not a grid of anonymous cells.
    await expect(main.getByRole("rowheader", { name: "Operation history" })).toBeVisible();
    await expect(main.getByRole("columnheader", { name: "Kept for" })).toBeVisible();
    // The three retention numbers the copy promises.
    await expect(main.getByRole("row", { name: /Library cache\s+7 days/ })).toBeVisible();
    await expect(
      main.getByRole("row", { name: /Inactive accounts\s+Deleted after 24 months/ }),
    ).toBeVisible();

    await expect(main.getByRole("link", { name: "Full privacy policy" })).toHaveAttribute(
      "href",
      "/privacy/",
    );

    await assertNoSeriousViolations(page);
  });

  test("Download my data navigates to the export route", async ({ page }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    // Asserting the request, not a saved file: the page hands the URL to the
    // browser and the server's Content-Disposition does the rest, so the
    // request is the whole of what this page is responsible for.
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/auth/export")),
      page.getByRole("main").getByRole("button", { name: "Download my data" }).click(),
    ]);

    expect(request.method()).toBe("GET");
    await expect(page.locator("#app-live-region")).toHaveText("Preparing your download");
  });

  test("Delete account: confirm is disabled until DELETE is typed", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    const trigger = page.getByRole("main").getByRole("button", { name: "Delete account" });
    // Opened from the keyboard: Chromium on macOS does not focus a <button>
    // on click, so a click would leave document.body as the element to
    // restore to and the focus-return assertion would prove nothing.
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName("Delete your account?");

    const confirm = dialog.getByRole("button", { name: "Delete my account" });
    await expect(confirm).toBeDisabled();

    const input = dialog.getByRole("textbox", { name: "Type DELETE to confirm" });
    await input.fill("delete");
    await expect(confirm).toBeDisabled();

    await input.fill("DELETE");
    await expect(confirm).toBeEnabled();

    await assertNoSeriousViolations(page);

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/api/auth/account") && req.method() === "DELETE",
      ),
      confirm.click(),
    ]);
    expect(request.postDataJSON()).toEqual({ confirm: "DELETE" });
  });

  /**
   * The shared `Dialog` contract, on the dialog that drove it.
   *
   * `a11y.spec.ts` used to own this test. It drove the delete-account dialog,
   * which moved to `/account` in Task 7, and the test was deleted with the
   * route rather than moved — so the four guarantees below went unasserted
   * anywhere while still looking covered, because `/account` had tests about
   * dialogs. Escape and focus-return are asserted in the next test; the two
   * here are the ones that were genuinely lost.
   *
   * `toHaveAccessibleName` is not a substitute for the first of them. It
   * passes just as happily when the name comes from an `aria-label` that has
   * drifted away from the heading people can actually see — which is the
   * failure worth catching, since a screen reader would then announce one
   * thing and the screen show another. Resolving the `aria-labelledby` id to
   * an element and comparing its text is what proves they are the same string.
   */
  test("Delete account: the dialog is labelled by its visible heading", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    const trigger = page.getByRole("main").getByRole("button", { name: "Delete account" });
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const labelledBy = await dialog.getAttribute("aria-labelledby");
    expect(labelledBy, "dialog has no aria-labelledby").toBeTruthy();

    // The id must resolve, the element must be the heading, and that heading
    // must be on screen — an `aria-labelledby` pointing at a visually-hidden
    // or detached node is the same drift in a different costume.
    const label = page.locator(`#${labelledBy}`);
    await expect(label).toBeVisible();
    await expect(label).toHaveText("Delete your account?");
    expect(await label.evaluate((el) => el.tagName)).toBe("H2");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("Delete account: Tab cycles inside the dialog", async ({ page }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    const trigger = page.getByRole("main").getByRole("button", { name: "Delete account" });
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // `aria-modal` is a promise to assistive tech, not a behaviour: the
    // browser still tabs into the page behind the overlay unless something
    // wraps focus. Tabbing more times than there are stops and finding focus
    // still inside is the assertion that the trap exists; counting exact
    // stops would just re-describe this dialog's current markup.
    const stops = await dialog.locator(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ).count();
    expect(stops, "dialog has no focusable controls").toBeGreaterThan(1);

    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press("Tab");
      await expect(
        dialog.locator(":focus"),
        `focus escaped the dialog after ${i + 1} Tab press(es)`,
      ).toHaveCount(1);
    }

    // And backwards, which is a separate branch in the trap.
    for (let i = 0; i < stops + 2; i++) {
      await page.keyboard.press("Shift+Tab");
      await expect(
        dialog.locator(":focus"),
        `focus escaped the dialog after ${i + 1} Shift+Tab press(es)`,
      ).toHaveCount(1);
    }
  });

  test("Delete account: Escape closes the dialog and returns focus", async ({
    page,
  }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    const trigger = page.getByRole("main").getByRole("button", { name: "Delete account" });
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("Disconnect asks first, then posts", async ({ page }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto("/account/");

    const trigger = page.getByRole("main").getByRole("button", { name: "Disconnect" });
    await trigger.focus();
    await trigger.press("Enter");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName("Disconnect from SoundCloud?");
    // Opens on Cancel, so a stray Enter never confirms.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/api/auth/disconnect") && req.method() === "POST",
      ),
      dialog.getByRole("button", { name: "Disconnect", exact: true }).click(),
    ]);
    expect(request.method()).toBe("POST");
  });

  test("every control clears 44px and goes full-width at 360", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "m360", "m360 only");

    await page.goto("/account/");

    const main = page.getByRole("main");
    const labels = ["Download my data", "Disconnect", "Delete account"];

    for (const name of labels) {
      const box = await main.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(44);
    }

    // Full-width below `sm`: each button fills its card, so they all share a
    // width. Comparing them to each other avoids hard-coding the gutter.
    const widths = await Promise.all(
      labels.map(async (name) => {
        const box = await main.getByRole("button", { name }).boundingBox();
        return Math.round(box?.width ?? 0);
      }),
    );
    expect(new Set(widths).size, `widths were ${widths.join(", ")}`).toBe(1);
    expect(widths[0]).toBeGreaterThan(200);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
      clientWidth,
    );
  });
});
