import { defineConfig } from "@playwright/test";

import { baseConfig, webVaultServer } from "./playwright.base";
import { WEB_VAULT_URL } from "./src/server";

/**
 * Flows spanning clients: the web vault next to the browser extension, in one
 * persistent Chromium context with the extension loaded (see src/browser/fixtures.ts),
 * and the extension next to the desktop app (see src/shared/desktop-fixtures.ts).
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
