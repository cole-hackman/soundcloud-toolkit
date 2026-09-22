import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi } from "./fixtures/api";

/**
 * The deep link the app-wide error boundary and the "Report a problem" links
 * produce: a pre-selected type plus the page the user came from.
 */
const DEEP_LINK = "/feedback/?type=bug&from=/like-manager";

/** Long enough to clear the server's `min: 10` on `message`. */
const MESSAGE = "The like list stalls";

async function assertNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

test.describe("feedback form", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    // Same reasoning as a11y.spec.ts: entrance animations hold a partial
    // opacity that axe reads as a contrast failure mid-flight.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("prefills from the deep link, submits, and confirms", async ({ page }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto(DEEP_LINK);

    // Scoped to <main>: the sidebar carries its own "Like Manager" link, and
    // Next's route announcer is a second role="alert" outside the page.
    const main = page.getByRole("main");

    // `?type=bug` selects the Bug radio; `?from=` resolves to the tool name.
    await expect(page.getByRole("radio", { name: "Bug" })).toBeChecked();
    await expect(main.getByText("Like Manager", { exact: true })).toBeVisible();

    // The honeypot is `aria-hidden`, so it must not reach the accessibility
    // tree at all — a role query is resolved against that tree, not the DOM.
    await expect(page.getByRole("textbox", { name: "Website" })).toHaveCount(0);

    await assertNoSeriousViolations(page);

    const textarea = page.getByRole("textbox", {
      name: /What happened, or what would you like\?/,
    });
    await textarea.fill(MESSAGE);

    // The submit target has to clear the 44px floor on a phone.
    const submit = page.getByRole("button", { name: "Send feedback" });
    const box = await submit.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/api/feedback") && req.method() === "POST",
      ),
      submit.click(),
    ]);

    expect(request.postDataJSON()).toMatchObject({
      type: "bug",
      page: "/like-manager",
      website: "",
      message: MESSAGE,
    });

    const confirmation = page.getByRole("status").filter({ hasText: "Thanks" });
    await expect(confirmation).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thanks — got it" })).toBeVisible();
    // Focus moves to the confirmation heading, not back to <body>.
    await expect(page.getByRole("heading", { name: "Thanks — got it" })).toBeFocused();

    await assertNoSeriousViolations(page);
  });

  test("an empty message shows an error and focuses the textarea", async ({ page }, testInfo) => {
    test.skip(
      !["desktop", "m360"].includes(testInfo.project.name),
      "runs at desktop and the narrowest phone",
    );

    await page.goto(DEEP_LINK);

    await page.getByRole("button", { name: "Send feedback" }).click();

    // Scoped to <main> — Next's route announcer is a second role="alert".
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("at least 10 characters");

    await expect(
      page.getByRole("textbox", { name: /What happened, or what would you like\?/ }),
    ).toBeFocused();
  });

  test("no horizontal overflow at 360, and the textarea is 16px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "m360", "m360 only");

    await page.goto(DEEP_LINK);

    // Under 16px, iOS Safari zooms the viewport on focus.
    const fontSize = await page
      .getByRole("textbox", { name: /What happened, or what would you like\?/ })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
      clientWidth,
    );
  });
});
