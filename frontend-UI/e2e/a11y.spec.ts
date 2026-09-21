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
