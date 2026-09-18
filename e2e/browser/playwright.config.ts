import { defineConfig } from "@playwright/test";

// The extension is built and loaded into Chrome for Testing outside Playwright,
// which then attaches to its CDP port. One browser instance means no parallelism.
const CDP_VERSION_URL = "http://127.0.0.1:9200/json/version";
const BUILD_AND_LAUNCH_TIMEOUT = 15 * 60 * 1000;

export default defineConfig({
  // One browser instance is shared by all files; the numeric filename prefixes
  // keep them in a working order (log in first).
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  outputDir: "./test-results",
  use: { trace: "retain-on-failure" },
  webServer: {
    command: "node ./e2e/browser/start.js",
    cwd: "../..",
    url: CDP_VERSION_URL,
    timeout: BUILD_AND_LAUNCH_TIMEOUT,
    // Never talk to a browser someone else started: its profile is not clean.
    reuseExistingServer: false,
    // Only the launcher's own few lines reach here: it writes the app's build and
    // run output to a log file under .debug/.
    stdout: "pipe",
    stderr: "pipe",
  },
});
