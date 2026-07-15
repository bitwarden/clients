import path from "node:path";

import { defineConfig } from "@playwright/test";

const testDir = __dirname;

/**
 * Browser-extension E2E config. Env layering and the extension build happen in `globalSetup`
 * (`support/build-extension.ts`); the persistent context that loads the unpacked extension is set
 * up per test in `support/extension.fixture.ts`. Headless is handled in the fixture (MV3 needs a
 * headed browser), not here.
 *
 * See https://playwright.dev/docs/chrome-extensions.
 */
export default defineConfig({
  testDir: path.resolve(testDir, "smoke"),
  testMatch: ["**/*.play.spec.ts"],
  globalSetup: path.resolve(testDir, "support/build-extension.ts"),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["html", { open: "never", outputFolder: path.resolve(testDir, "playwright-report") }],
    ["list"],
  ],
  outputDir: path.resolve(testDir, "artifacts"),
  // Each test drives its own persistent context; keep the suite serial for stability.
  workers: 1,
  // The popup opens after the env change and each cold MV3 handshake is slow.
  timeout: 240_000,
  use: {
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // The project name selects the Nx build target (chrome -> chrome-dev); the launch binary is
  // Playwright's bundled Chromium (set in the fixture), which still supports --load-extension.
  projects: [{ name: "chrome", use: { channel: "chromium" } }],
});
