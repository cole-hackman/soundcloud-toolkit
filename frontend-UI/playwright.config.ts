import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 0 e2e harness: axe + mobile-overflow checks against the static
 * export, served the same way `server/index.js` will serve it (see
 * e2e/static-server.mjs). No dev server, no backend — `mockApi` in
 * e2e/fixtures/api.ts stands in for the Express API.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",

  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },

  webServer: {
    command: "node e2e/static-server.mjs",
    port: 4173,
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
