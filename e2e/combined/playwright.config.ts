import { defineConfig } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

// Cross-client scenarios: the desktop app and the extension run side by side and
// talk over native messaging. `start.js` brings both up, pairs them, and only then
// answers the readiness URL.
const READINESS_URL = "http://127.0.0.1:9250";
const BUILD_AND_LAUNCH_TIMEOUT = 20 * 60 * 1000;

const bddTestDir = defineBddConfig({
  features: "./features/*.feature",
  steps: ["./steps/*.ts", "./utils/bdd.ts"],
  outputDir: "./.features-gen",
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
    stdout: "pipe",
    stderr: "pipe",
  },
});
