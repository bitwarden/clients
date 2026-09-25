import { defineConfig } from "@playwright/test";

import { baseConfig, WEB_VAULT_URL, webVaultServer } from "./playwright.base";

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/web",
  use: {
    ...baseConfig.use,
    baseURL: WEB_VAULT_URL,
    // The dev server's certificate is self-signed.
    ignoreHTTPSErrors: true,
  },
  webServer: webVaultServer,
});
