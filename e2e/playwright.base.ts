import { PlaywrightTestConfig } from "@playwright/test";

/** Tests are named `.e2e.ts` so the repo's jest projects never pick them up. */
const TEST_MATCH = "**/*.e2e.ts";

const CI = !!process.env.CI;

/**
 * Settings every client suite shares. A client suite adds its own `testDir`, and
 * whatever it needs to get a build of that client running.
 */
export const baseConfig: PlaywrightTestConfig = {
  testMatch: TEST_MATCH,
  outputDir: "test-results",
  fullyParallel: false,
  // A logged-in vault is shared, mutable state; a retried login is fine, a parallel one is not.
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
};
