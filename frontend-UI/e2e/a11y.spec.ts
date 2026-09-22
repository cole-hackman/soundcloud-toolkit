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
  { path: "/like-manager/", needsMock: true },
  { path: "/following-manager/", needsMock: true },
  { path: "/repost-manager/", needsMock: true },
  { path: "/combine/", needsMock: true },
  { path: "/playlist-modifier/", needsMock: true },
  { path: "/growth/", needsMock: true },
  { path: "/feedback/", needsMock: true },
  { path: "/account/", needsMock: true },
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

    // Audit the page, not the spinner. `AppLayout` renders a hydration/auth
    // gate before it mounts any child, so on a fast run `analyze()` can catch
    // that spinner, find nothing wrong with it, and pass without the real page
    // ever having been scanned. Every protected route puts an <h1> on screen —
    // via `PageHeader`, or its own on the dashboard — so waiting for the main
    // landmark and a heading is the cheap, route-agnostic proof that the
    // content under test is mounted.
    if (needsMock) {
      await expect(page.locator("main#main-content")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
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
 * The shared `Dialog` primitive, exercised through a confirm that is reachable
 * from a mocked page without a write: `/like-manager/`'s bulk-unlike prompt.
 * (It used to be the sidebar's delete-account confirm; that moved to
 * `/account`.) Covers the five things a modal has to get right — it is
 * labelled by its visible heading, `initialFocusRef` beats "first focusable",
 * Tab wraps rather than escaping, Escape closes it, and focus goes back where
 * it came from.
 *
 * The panel's focusables in DOM order are: "Export selection"
 * (BulkReviewDetails), Cancel, then the confirm button. Cancel is in the
 * middle, which is the point — it is focused first only because
 * `ConfirmDialog` passes it as `initialFocusRef`.
 */
test("Dialog: labelled by its heading, honours initialFocusRef, wraps Tab, Escape restores focus", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/like-manager/");

  // Select a track so the banner — and with it the trigger — appears.
  const firstRow = page.getByRole("checkbox", { name: "Sample Track 1" });
  await expect(firstRow).toBeVisible();
  await firstRow.focus();
  await page.keyboard.press("Space");

  // Opened from the keyboard on purpose: Chromium does not focus a <button>
  // on a mouse click, so a click would leave `document.body` as the element to
  // restore to and the last assertion would prove nothing.
  const trigger = page.getByRole("button", { name: /Unlike Selected/ });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // aria-labelledby must resolve to the visible h2, not to a hidden string.
  await expect(dialog).toHaveAccessibleName("Unlike selected tracks?");
  await expect(
    dialog.getByRole("heading", { level: 2, name: "Unlike selected tracks?" }),
  ).toBeVisible();

  const exportButton = dialog.getByRole("button", { name: "Export selection" });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const confirm = dialog.getByRole("button", { name: "Unlike", exact: true });

  // Opens on Cancel, so a stray Enter never confirms a destructive action —
  // and it is not the first focusable, so this can only pass via
  // `initialFocusRef`.
  await expect(cancel).toBeFocused();

  // Shift+Tab off the first element wraps to the last, and Tab off the last
  // wraps back to the first. Both assertions fail the moment focus is allowed
  // to reach the page behind the dialog.
  await page.keyboard.press("Shift+Tab");
  await expect(exportButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(exportButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

/**
 * Combine's target-playlist picker was the last hand-rolled focus trap in the
 * app; Phase 6 deleted it in favour of the shared `Dialog`. A dialog that is
 * closed on load is invisible to the route's own axe run, so the behaviour
 * that was deleted is asserted here instead: it is labelled by its heading,
 * Escape closes it, focus returns to the trigger, and the open dialog is
 * clean.
 */
test("combine: the target-playlist picker is the shared Dialog", async ({ page }) => {
  await mockApi(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/combine/");

  await page.getByRole("button", { name: "Existing playlist" }).click();

  const trigger = page.getByRole("button", { name: "Choose a target playlist…" });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName("Target Playlist");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);

  // More presses than the panel has stops, so the trap must wrap to hold.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]');
      return !!panel && !!document.activeElement && panel.contains(document.activeElement);
    });
    expect(inside, `focus escaped the picker after ${i + 1} Tab(s)`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  // Choosing an option closes the picker too, and focus has to land back on
  // the trigger there as well. That only works because React reuses the same
  // <button> node across the "Choose a target playlist…" / "Change" ternary —
  // add a `key` or a wrapper and `returnFocusRef` would point at a detached
  // node and focus would fall to <body>. Pinned here so that stays true.
  await trigger.focus();
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Sample Playlist 1/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Change/ })).toBeFocused();
});

/**
 * Selection is a real checkbox, and the banner that appears is a status
 * region rather than a silent strip of pixels. Both are the point of
 * SelectableRow / SelectionBanner, and neither is visible to axe.
 */
test("selection: the checkbox drives the count, and the banner is a status region", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/like-manager/");

  const firstRow = page.getByRole("checkbox", { name: "Sample Track 1" });
  await expect(firstRow).toBeVisible();
  await expect(firstRow).not.toBeChecked();

  // Keyboard-native: no Enter/Space handler of our own is involved.
  await firstRow.focus();
  await page.keyboard.press("Space");
  await expect(firstRow).toBeChecked();

  const status = page.locator("[role=status]");
  await expect(status).toContainText("1");

  // The banner's action is reachable from the row by Tab alone — it is a
  // button in the document, not something only a pointer can get to.
  const action = page.getByRole("button", { name: /Unlike Selected/ });
  await expect(action).toBeVisible();

  let reached = false;
  for (let i = 0; i < 25 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = await action.evaluate((element) => element === document.activeElement);
  }
  expect(reached, "Tab never reached the selection banner's action button").toBe(true);
});

/**
 * Regression guard for the row body. Clicking the row toggles it through a
 * `<label>`, and Chromium skips forwarding a label click to its control when
 * the click extended a text selection — which a shift-click does unless the
 * label is `select-none`. Without that class this passes on the checkbox and
 * silently fails on the row, which is where people actually click.
 */
test("selection: shift-clicking the row body selects a range", async ({ page }) => {
  await mockApi(page);
  await page.goto("/like-manager/");

  await page.getByText("Sample Track 1", { exact: true }).click();
  await page.getByText("Sample Track 3", { exact: true }).click({ modifiers: ["Shift"] });

  await expect(page.getByRole("checkbox", { name: "Sample Track 2" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Sample Track 3" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Sample Track 4" })).not.toBeChecked();
});
