import { test, expect, type Locator, type Page } from "@playwright/test";
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
  /**
   * Drive the page into the state worth auditing and return something that
   * only exists once the route's *own* content is on screen.
   *
   * Two ways an audit lies without this. `AppLayout` renders a hydration/auth
   * spinner first, so a fast run can scan that and pass on a page it never
   * saw. And a page whose fixture is missing renders its `EmptyState` — which
   * has a heading of its own, so merely waiting for a heading settles on an
   * empty page and audits nothing that was fixed. Naming a real row, tab or
   * control closes both.
   */
  ready?: (page: Page) => Promise<Locator>;
}

/** The page's own `<h1>`, which every `(app)` route renders via `PageHeader`. */
const h1 = async (page: Page) => page.getByRole("heading", { level: 1 });

const PAGES: PageCase[] = [
  { path: "/" },
  { path: "/about/" },
  { path: "/faq/" },
  { path: "/terms/" },
  { path: "/privacy/" },
  { path: "/accessibility/" },
  { path: "/login/" },
  { path: "/does-not-exist/", expectedStatus: 404 },
  {
    path: "/dashboard/",
    needsMock: true,
    // `dashboard/loading.tsx` skeletons the header instead of rendering a
    // `PageHeader`, so the h1 alone would be a fair gate here — but the tool
    // search only exists on the loaded page, which is the stronger signal.
    ready: async (page) => page.getByLabel("Search tools"),
  },
  {
    path: "/like-manager/",
    needsMock: true,
    fixme: "Phase 6 — the sort <select> has no accessible name (select-name)",
  },
  { path: "/playlist-modifier/", needsMock: true },
  { path: "/growth/", needsMock: true },
  { path: "/feedback/", needsMock: true },
  {
    path: "/playlist-keyword-search/",
    needsMock: true,
    // The "no search yet" empty state is not what this page is: the toolbar,
    // the match rows and their badges only exist after a search, so run one.
    ready: async (page) => {
      await page.getByLabel("Keywords").fill("sample");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      return page.getByRole("heading", { name: "Matches" });
    },
  },
  {
    path: "/playlist-health-check/",
    needsMock: true,
    // The scan results — summary bar, filter pills, per-row badges — only
    // exist once a playlist is picked.
    ready: async (page) => {
      await page.getByRole("button", { name: /Sample Playlist 1/ }).click();
      return page.getByRole("group", { name: "Filter tracks" });
    },
  },
  {
    path: "/batch-link-resolver/",
    needsMock: true,
    // Resolve something: the filters, the row actions and the error styling
    // only exist once there are results.
    ready: async (page) => {
      await page
        .getByLabel("SoundCloud URLs (one per line)")
        .fill("https://soundcloud.com/testartist/sample-track-1");
      await page.getByRole("button", { name: "Resolve All" }).click();
      return page.getByRole("heading", { name: "Results" });
    },
  },
  {
    path: "/following-library/",
    needsMock: true,
    // Switch to the Playlists tab: it exercises the tab strip, the tabpanel
    // and the selectable playlist rows in one go, and none of that exists
    // while the page is still the "select a followed user" empty state.
    ready: async (page) => {
      await page.getByRole("tab", { name: "Playlists", exact: true }).click();
      return page.getByRole("checkbox", { name: "Sample Public Playlist 1" });
    },
  },
  {
    path: "/library-audit/",
    needsMock: true,
    // Nothing is fetched until the audit is run, so run it: the metric cards,
    // the findings rows and the pager are all downstream of that click.
    ready: async (page) => {
      await page.getByRole("button", { name: "Run playlist audit" }).click();
      return page.getByRole("heading", { name: "Playlist findings" });
    },
  },
];

for (const { path, needsMock, fixme, expectedStatus, ready } of PAGES) {
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

    // Audit the route, not the shell's spinner and not an empty state. See
    // `PageCase.ready`.
    if (needsMock) {
      await expect(await (ready ?? h1)(page)).toBeVisible();

      // Park the cursor. A `ready` hook that clicks leaves it wherever it
      // clicked, and after the re-render some other control can be sitting
      // under it — so axe measures a `:hover` style on an element nobody is
      // pointing at, and which project's viewport happens to put a control
      // there decides whether the run passes. Axe never hovers anything by
      // itself; this restores that. (0,0) is over layout containers only.
      await page.mouse.move(0, 0);
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

/**
 * The app's one real `role="tablist"`. ARIA's tab pattern is a keyboard
 * contract, not a set of attributes: the strip is a single stop in the tab
 * order and the arrow keys move between the tabs inside it. None of that is
 * visible to axe, which is happy with three buttons that say they are tabs.
 */
test("following-library: the tab strip is one tab stop and the arrow keys move between tabs", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/following-library/");

  const likes = page.getByRole("tab", { name: "Liked Tracks" });
  const playlists = page.getByRole("tab", { name: "Playlists", exact: true });
  const liked = page.getByRole("tab", { name: "Liked Playlists" });

  await expect(likes).toBeVisible();
  await expect(likes).toHaveAttribute("aria-selected", "true");

  // Roving tabIndex: only the selected tab is reachable with Tab.
  await expect(likes).toHaveAttribute("tabindex", "0");
  await expect(playlists).toHaveAttribute("tabindex", "-1");
  await expect(liked).toHaveAttribute("tabindex", "-1");

  await likes.focus();
  await page.keyboard.press("ArrowRight");
  await expect(playlists).toBeFocused();
  await expect(playlists).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(liked).toBeFocused();

  await page.keyboard.press("Home");
  await expect(likes).toBeFocused();

  // ArrowLeft from the first tab wraps to the last.
  await page.keyboard.press("ArrowLeft");
  await expect(liked).toBeFocused();

  // The panel is named by its tab, so a screen reader can tell which list it
  // has landed in.
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Liked Playlists");
});
