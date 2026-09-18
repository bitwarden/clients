import { defineConfig, devices } from "@playwright/test";

// Unlike desktop and the extension, the web vault runs in a browser Playwright
// launches itself, so these tests get a clean profile for free.
const DEV_SERVER_URL = "https://localhost:8080";
const BUILD_AND_LAUNCH_TIMEOUT = 15 * 60 * 1000;

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  outputDir: "./test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: DEV_SERVER_URL,
    // The dev server uses a self-signed certificate.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node ./e2e/web/start.js",
    cwd: "../..",
    url: DEV_SERVER_URL,
    timeout: BUILD_AND_LAUNCH_TIMEOUT,
    ignoreHTTPSErrors: true,
    // A dev server someone else started is fine: the browser profile is ours.
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
  },
});
