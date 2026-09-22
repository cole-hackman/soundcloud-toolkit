import { test, expect, type Page } from "@playwright/test";
import { mockApi } from "./fixtures/api";

const MOBILE_PROJECTS = ["m360", "m390", "m430"];

interface PageCase {
  path: string;
  needsMock?: boolean;
  /** Set when the page is known to overflow today; names the phase that fixes it. */
  fixme?: string;
}

const PAGES: PageCase[] = [
  { path: "/" },
  { path: "/about/" },
  { path: "/faq/" },
  { path: "/terms/" },
  { path: "/privacy/" },
  { path: "/accessibility/" },
  { path: "/login/" },
  { path: "/does-not-exist/" },
  { path: "/dashboard/", needsMock: true },
  { path: "/like-manager/", needsMock: true },
  { path: "/playlist-modifier/", needsMock: true },
  { path: "/link-resolver/", needsMock: true },
  { path: "/feedback/", needsMock: true },
  // Fixed in Phase 6: the tab strip's three long labels ("Discover
  // Suggestions" / "Campaign History" / "Analytics") were a `w-fit` row that
  // measured ~397px, which is the whole of the overflow this fixme recorded.
  // Short labels below `sm` plus equal-width tabs bring it inside 360.
  { path: "/growth/", needsMock: true },
];

/**
 * Every element matching `selector` must have a bounding box of at least
 * min x min CSS pixels (WCAG 2.2 SC 2.5.8 Target Size, Minimum). Used for
 * mobile tap targets, where the desktop `min-h`/`min-w` utility classes may
 * not carry through.
 */
export async function assertTapTargets(page: Page, selector: string, min: number) {
  const undersized = await page.locator(selector).evaluateAll(
    (elements, minSize) =>
      elements
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
          };
        })
        .filter((box) => box.width < minSize || box.height < minSize),
    min,
  );

  expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
}

for (const { path, needsMock, fixme } of PAGES) {
  test(`no horizontal overflow: ${path}`, async ({ page }, testInfo) => {
    test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");
    test.fixme(!!fixme, fixme);

    if (needsMock) {
      await mockApi(page);
    }

    await page.goto(path);

    // Compare against `clientWidth`, not `window.innerWidth`: on content
    // wider than the device, Chromium's mobile emulation can expand the
    // *layout* viewport (`innerWidth`) to fit it, and `scrollWidth` grows
    // right along with it — the two drift together and the check can never
    // fail. `document.documentElement.clientWidth` stays pinned to the
    // actual device width regardless, so it is the correct comparand for
    // "does this page require horizontal scrolling on a real phone."
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
      clientWidth,
    );
  });
}

/**
 * The playlist-modifier track editor is only reachable after picking a
 * playlist, so the load-state overflow check above never sees it — and that
 * is exactly where the row actions live. Before Phase 6 the cluster was
 * `opacity-0 group-hover:opacity-100` below `sm`: invisible on a phone, and
 * still tappable, so a stray touch reordered or removed a track with nothing
 * on screen to explain it.
 */
test("playlist-modifier row actions are visible and fit: /playlist-modifier/", async ({
  page,
}, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/playlist-modifier/");

  await page.getByRole("button", { name: "Sample Playlist 1" }).click();

  const moreActions = page.getByRole("button", {
    name: "More actions for Sample Playlist Track 1",
  });
  await expect(moreActions).toBeVisible();
  await expect(moreActions).toHaveCSS("opacity", "1");

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`).toBeLessThanOrEqual(
    clientWidth,
  );

  // The sheet replaces a popover that was clipped inside the virtual
  // scroller; on a phone it is also where reorder and remove live.
  await moreActions.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAccessibleName("Track actions");
  await expect(sheet.getByRole("button", { name: "Move down" })).toBeEnabled();
  await expect(sheet.getByRole("button", { name: "Move up" })).toBeDisabled();
  await expect(sheet.getByRole("button", { name: "Remove from playlist" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(moreActions).toBeFocused();
});

/**
 * The growth tab strip is a real tablist now, and the other two panels are
 * only reachable through it — so neither the load-state overflow check nor
 * the axe audit sees them unless a test switches tabs.
 */
test("growth tabs: arrow keys move between panels and none of them overflow: /growth/", async ({
  page,
}, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/growth/");

  const tablist = page.getByRole("tablist", { name: "Growth sections" });
  const discover = tablist.getByRole("tab", { name: "Discover" });
  const history = tablist.getByRole("tab", { name: "History" });
  const analytics = tablist.getByRole("tab", { name: "Analytics" });

  await expect(discover).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();

  await discover.focus();
  await page.keyboard.press("ArrowRight");
  await expect(history).toBeFocused();
  await expect(history).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowRight");
  await expect(analytics).toHaveAttribute("aria-selected", "true");

  // Wraps, so the strip is navigable in one direction alone.
  await page.keyboard.press("ArrowRight");
  await expect(discover).toHaveAttribute("aria-selected", "true");

  for (const tab of [history, analytics]) {
    await tab.click();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `${await tab.textContent()}: scrollWidth=${scrollWidth} clientWidth=${clientWidth}`,
    ).toBeLessThanOrEqual(clientWidth);
  }
});

test("dashboard tap targets are at least 24x24: /dashboard/", async ({ page }, testInfo) => {
  test.skip(!MOBILE_PROJECTS.includes(testInfo.project.name), "mobile projects only");

  await mockApi(page);
  await page.goto("/dashboard/");
  await assertTapTargets(page, "main a, main button", 24);
});
