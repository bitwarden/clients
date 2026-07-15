import * as fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

const testDir = __dirname;

// Layer env files lowest-to-highest: `.env` (shared defaults) then `.env.${ENV}` (per-environment).
// Real shell/CI vars always win, so nothing here clobbers an explicitly-set variable.
const parseEnv = (file: string): Record<string, string> => {
  const p = path.resolve(testDir, file);
  return fs.existsSync(p) ? dotenv.parse(fs.readFileSync(p)) : {};
};
const baseEnv = parseEnv(".env");
const ENV = process.env.ENV ?? baseEnv.ENV ?? "development";
for (const [key, value] of Object.entries({ ...baseEnv, ...parseEnv(`.env.${ENV}`) })) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

export const webServerBaseUrl =
  process.env.WEB_SERVER_BASE_URL ?? process.env.BW_SERVER_URL ?? "https://localhost:8080";

// Opt in to building/serving the local dev server; by default the suite targets an already-running
// server at `webServerBaseUrl` (the account must already exist there).
const startLocalServer = process.env.START_WEB_SERVER === "true";

/** See https://playwright.dev/docs/test-configuration. */
export default defineConfig({
  testDir: path.resolve(testDir, "smoke"),
  testMatch: ["**/*.play.spec.ts"],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["html", { open: "never", outputFolder: path.resolve(testDir, "playwright-report") }],
    ["list"],
  ],
  outputDir: path.resolve(testDir, "artifacts"),
  timeout: 120_000,
  use: {
    baseURL: webServerBaseUrl,
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: process.env.HEADLESS !== "false",
    locale: "en-US",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: startLocalServer
    ? {
        command: "cd apps/web && npm run build:bit:watch",
        cwd: path.resolve(testDir, "../../.."),
        url: webServerBaseUrl,
        reuseExistingServer: !process.env.CI,
        ignoreHTTPSErrors: true,
        timeout: 120_000,
      }
    : undefined,
});
