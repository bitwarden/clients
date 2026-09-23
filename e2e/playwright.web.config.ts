import { defineConfig } from "@playwright/test";

import { baseConfig } from "./playwright.base";
import { LOCAL_WEB_VAULT_URL } from "./src/credentials";

// `build:oss:watch` is `webpack serve`: it builds the client and serves it with the
// /api, /identity, … proxies from apps/web/config/development.json, which the client
// needs to reach the local server at all.
const SERVE_COMMAND = "npm run build:oss:watch --workspace @bitwarden/web-vault";
const BUILD_TIMEOUT_MS = 600_000;

// `E2E_WEB_URL` points the suite at an already-deployed web vault instead — useful when
// there is no local stack. Pair it with an `E2E_ACCOUNT` that lives on that server.
const url = process.env.E2E_WEB_URL ?? LOCAL_WEB_VAULT_URL;
const buildLocally = url === LOCAL_WEB_VAULT_URL;

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/web",
  use: {
    ...baseConfig.use,
    baseURL: url,
    // The dev server's certificate is self-signed.
    ignoreHTTPSErrors: true,
  },
  webServer: buildLocally
    ? {
        command: SERVE_COMMAND,
        url,
        cwd: "..",
        ignoreHTTPSErrors: true,
        reuseExistingServer: !process.env.CI,
        timeout: BUILD_TIMEOUT_MS,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
