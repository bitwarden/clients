import { PlaywrightTestConfig } from "@playwright/test";

import { LOCAL_WEB_VAULT_URL } from "./src/credentials";

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

// `build:oss:watch` is `webpack serve`: it builds the client and serves it with the
// /api, /identity, … proxies from apps/web/config/development.json, which the client
// needs to reach the local server at all.
const SERVE_COMMAND = "npm run build:oss:watch --workspace @bitwarden/web-vault";
const BUILD_TIMEOUT_MS = 600_000;

// `E2E_WEB_URL` points a suite at an already-deployed web vault instead — useful when
// there is no local stack. Pair it with an `E2E_ACCOUNT` that lives on that server.
export const WEB_VAULT_URL = process.env.E2E_WEB_URL ?? LOCAL_WEB_VAULT_URL;

/** Builds and serves the web vault for suites that drive it, unless one is deployed. */
export const webVaultServer: PlaywrightTestConfig["webServer"] =
  WEB_VAULT_URL === LOCAL_WEB_VAULT_URL
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
