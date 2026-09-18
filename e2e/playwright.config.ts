import { defineConfig } from "@playwright/test";

// The desktop app is started from a wiped debug profile and Playwright attaches to
// its CDP port, so the tests always run against a fresh, logged-out app. A single
// app instance means no parallelism.
const CDP_VERSION_URL = "http://127.0.0.1:9222/json/version";
const BUILD_AND_LAUNCH_TIMEOUT = 15 * 60 * 1000;

export default defineConfig({
  // One app instance is shared by all files; the numeric filename prefixes keep
  // them in a working order (log in first).
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  outputDir: "./test-results",
  use: { trace: "retain-on-failure" },
  webServer: {
    command: "node ./e2e/scripts/start-desktop.js",
    cwd: "..",
    url: CDP_VERSION_URL,
    timeout: BUILD_AND_LAUNCH_TIMEOUT,
    // Never talk to an app someone else started: its profile is not clean.
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
