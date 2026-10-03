import { defineConfig } from "@playwright/test";

import { baseConfig, WEB_VAULT_URL, webVaultServer } from "./playwright.base";

/**
 * Flows spanning clients: the web vault next to the browser extension, in one
 * persistent Chromium context with the extension loaded (see src/browser/fixtures.ts).
 */
export default defineConfig({
  ...baseConfig,
  testDir: "./tests/shared",
  use: {
    ...baseConfig.use,
    baseURL: WEB_VAULT_URL,
  },
  webServer: webVaultServer,
});
