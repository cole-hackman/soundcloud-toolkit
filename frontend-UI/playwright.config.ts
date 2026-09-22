import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 0 e2e harness: axe + mobile-overflow checks against the static
 * export, served the same way `server/index.js` will serve it (see
 * e2e/static-server.mjs). No dev server, no backend — `mockApi` in
 * e2e/fixtures/api.ts stands in for the Express API.
 */
/**
 * `E2E_PORT` exists so two checkouts of this repo (a git worktree per task,
 * say) can run the suite at the same time. Playwright reuses an existing
 * server on the configured port, so a fixed one means the second run silently
 * tests the first checkout's `out/`.
 */
const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },

  webServer: {
    command: `node e2e/static-server.mjs --port=${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },

  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "m360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "m390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "m430",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 430, height: 932 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
