import { defineConfig } from "@playwright/test";

import { baseConfig, webVaultServer } from "./playwright.base";
import { IS_DEV_SERVER, WEB_VAULT_URL } from "./src/server";

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/web",
  use: {
    ...baseConfig.use,
    baseURL: WEB_VAULT_URL,
    ignoreHTTPSErrors: IS_DEV_SERVER,
  },
  webServer: webVaultServer,
});
