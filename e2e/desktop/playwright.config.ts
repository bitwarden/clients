import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// The desktop app is started from a wiped debug profile and Playwright attaches to
// its CDP port, so the tests always run against a fresh, logged-out app. A single
// app instance means no parallelism.
const CDP_VERSION_URL = "http://127.0.0.1:9222/json/version";
const BUILD_AND_LAUNCH_TIMEOUT = 15 * 60 * 1000;

// Gherkin features are compiled into Playwright test files under `.features-gen`,
// which is why they need a project of their own: a project has one testDir.
const bddTestDir = defineBddConfig({
  features: "./features/*.feature",
  steps: ["./steps/*.ts", "./utils/bdd.ts"],
  outputDir: "./.features-gen",
});

export default defineConfig({
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  outputDir: "./test-results",
  use: { trace: "retain-on-failure" },
  // One app instance is shared by all files; the numeric filename prefixes keep
  // them in a working order (log in first). The BDD scenarios run afterwards.
  projects: [
    { name: "specs", testDir: "./tests" },
    { name: "bdd", testDir: bddTestDir, dependencies: ["specs"] },
  ],
  webServer: {
    command: "node ./e2e/desktop/start.js",
    cwd: "../..",
    url: CDP_VERSION_URL,
    timeout: BUILD_AND_LAUNCH_TIMEOUT,
    // Never talk to an app someone else started: its profile is not clean.
    reuseExistingServer: false,
    // Only the launcher's own few lines reach here: it writes the app's build and
    // run output to a log file under .debug/.
    stdout: "pipe",
    stderr: "pipe",
  },
});
