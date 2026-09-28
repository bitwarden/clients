import { PlaywrightTestConfig } from "@playwright/test";

import { account } from "./src/credentials";
import { VIDEO_MODE } from "./src/video";

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
    video: VIDEO_MODE,
  },
};

const SERVE_COMMAND = "npm run build:bit:watch --workspace @bitwarden/web-vault";
const BUILD_TIMEOUT_MS = 600_000;

/** Where the dev server listens — see apps/web/config/base.json. */
const DEV_SERVER_URL = "https://localhost:8080";

/** The account's server; an account on a deployed vault skips the local build. */
export const WEB_VAULT_URL = account().server;

/** Builds and serves the web vault for suites that drive it, unless one is deployed. */
export const webVaultServer: PlaywrightTestConfig["webServer"] =
  new URL(WEB_VAULT_URL).origin === DEV_SERVER_URL
    ? {
        command: SERVE_COMMAND,
        url: WEB_VAULT_URL,
        cwd: "..",
        ignoreHTTPSErrors: true,
        reuseExistingServer: !process.env.CI,
        timeout: BUILD_TIMEOUT_MS,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined;
