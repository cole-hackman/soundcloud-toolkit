import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi } from "./fixtures/api";

interface PageCase {
  path: string;
  /** Needs the mocked `/api/*` responses (protected app pages). */
  needsMock?: boolean;
  /** Set when the page is known to fail today; names the phase that fixes it. */
  fixme?: string;
}

const CONTRAST_FIXME =
  "Phase 1 — brand-orange text/background combinations are under the 4.5:1 contrast minimum";

const PAGES: PageCase[] = [
  { path: "/", fixme: CONTRAST_FIXME },
  { path: "/about/" },
  { path: "/privacy/" },
  { path: "/accessibility/" },
  { path: "/login/", fixme: CONTRAST_FIXME },
  { path: "/does-not-exist/" },
  { path: "/dashboard/", needsMock: true, fixme: "Phase 1/2/6" },
  { path: "/like-manager/", needsMock: true, fixme: "Phase 1/2/6" },
  { path: "/playlist-modifier/", needsMock: true, fixme: "Phase 1/2/6" },
  { path: "/growth/", needsMock: true, fixme: "Phase 1/2/6" },
];

for (const { path, needsMock, fixme } of PAGES) {
  test(`has no serious/critical WCAG 2.2 AA violations: ${path}`, async ({ page }) => {
    test.fixme(!!fixme, fixme);

    if (needsMock) {
      await mockApi(page);
    }

    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();

    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
