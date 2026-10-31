import { defineConfig } from "@playwright/test";

import { baseConfig, webVaultServer } from "./playwright.base";

/**
 * Memory measurements of the browser extension (tests/browser-memory). Kept out of the
 * browser suite: a run takes minutes and reports numbers rather than pass/fail.
 */
export default defineConfig({
  ...baseConfig,
  testDir: "./tests/browser-memory",
  retries: 0,
  // The fixture launches its own context, without Playwright's tracing and video.
  use: {},
  webServer: webVaultServer,
});
