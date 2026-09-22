import path from "node:path";

import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Absolute, because playwright-bdd validates `featuresRoot` against the process
// cwd but resolves it against the config directory, so a relative path outside
// this folder fails validation before it is ever resolved.
const FEATURES_ROOT = path.resolve(__dirname, "../features");

// The desktop app is started from a wiped debug profile and Playwright attaches to
// its CDP port, so the tests always run against a fresh, logged-out app. A single
// app instance means no parallelism.
const CDP_VERSION_URL = "http://127.0.0.1:9222/json/version";
const BUILD_AND_LAUNCH_TIMEOUT = 15 * 60 * 1000;

// Gherkin features are compiled into Playwright test files under `.features-gen`,
// which is why they need a project of their own: a project has one testDir.
//
// The features live in one tree shared by every suite, organised by product area
// rather than by client, and each scenario names the suites it belongs to with a
// tag. Scenarios tagged for other suites are dropped here — silently, so
// `e2e/features/lint.mjs` guards against a missing or misspelt tag.
const bddTestDir = defineBddConfig({
  features: `${FEATURES_ROOT}/**/*.feature`,
  featuresRoot: FEATURES_ROOT,
  tags: "@desktop",
  steps: ["./steps/*.ts", "./utils/bdd.ts"],
  outputDir: "./.features-gen",
  // Match on the keyword too, not just the text. Without this a `Then` can bind
  // to a same-worded `Given` and quietly perform the action it was meant to
  // assert, which passes no matter what the app did.
  matchKeywords: true,
  // The tree carries scenarios this suite has no steps for yet. Generate them as
  // `fixme` so the gap shows up as skipped, instead of failing generation.
  missingSteps: "skip-scenario",
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
