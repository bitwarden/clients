import path from "node:path";

import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Absolute, because playwright-bdd validates `featuresRoot` against the process
// cwd but resolves it against the config directory, so a relative path outside
// this folder fails validation before it is ever resolved.
const FEATURES_ROOT = path.resolve(__dirname, "../features");

// Cross-client scenarios: the desktop app and the browser extension run side by
// side and talk over native messaging. `start.js` brings both up, pairs them, and
// only then answers the readiness URL.
const READINESS_URL = "http://127.0.0.1:9250";
const BUILD_AND_LAUNCH_TIMEOUT = 20 * 60 * 1000;

// The features live in one tree shared by every suite, organised by product area
// rather than by client, and each scenario names the suites it belongs to with a
// tag. This suite pairs the browser extension with the desktop app, so it takes
// `@browser-desktop` — the tag names the clients a scenario needs, which
// `combined` would not. It therefore picks up both the cross-client features and
// the browser-specific ones. Non-matching scenarios are dropped silently, so
// `e2e/features/lint.mjs` guards against a missing or misspelt tag.
const bddTestDir = defineBddConfig({
  features: `${FEATURES_ROOT}/**/*.feature`,
  featuresRoot: FEATURES_ROOT,
  tags: "@browser-desktop",
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
  testDir: bddTestDir,
  // Two clients, one instance each; the scenarios share them.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  outputDir: "./test-results",
  use: { trace: "retain-on-failure" },
  webServer: {
    command: "node ./e2e/combined/start.js",
    cwd: "../..",
    url: READINESS_URL,
    timeout: BUILD_AND_LAUNCH_TIMEOUT,
    // Never talk to clients someone else started: their profiles are not clean and
    // they are not paired.
    reuseExistingServer: false,
    // Only the launcher's own few lines reach here: it writes each client's build
    // and run output to a log file under .debug/.
    stdout: "pipe",
    stderr: "pipe",
  },
});
