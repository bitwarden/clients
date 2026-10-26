import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { BrowserContext, expect, mergeTests } from "@playwright/test";

import { NativeMessaging, popupUrl, test as browserTest } from "../browser/fixtures";
import { test as biometricsTest } from "../desktop/biometrics";
import { CHROME_PROFILE_DIR } from "../paths";

// Written by desktop's NativeMessagingMain into the profile BITWARDEN_CHROME_PROFILE_DIR names.
const HOST_MANIFEST = resolve(
  CHROME_PROFILE_DIR,
  "NativeMessagingHosts",
  "com.8bit.bitwarden.json",
);
const HOST_MANIFEST_TIMEOUT_MS = 60_000;

/**
 * Desktop finds a dev extension's id in Chromium's preferences, which Chromium writes lazily.
 * Adds the id to the host manifest itself; Chromium reads it on every connect.
 */
async function allowExtension(context: BrowserContext) {
  // Node's URL has no origin for the chrome-extension scheme.
  const origin = `chrome-extension://${new URL(await popupUrl(context)).hostname}/`;

  await expect
    .poll(() => existsSync(HOST_MANIFEST), {
      timeout: HOST_MANIFEST_TIMEOUT_MS,
      message: "Desktop wrote no native messaging host manifest",
    })
    .toBe(true);

  const manifest = JSON.parse(readFileSync(HOST_MANIFEST, "utf8"));
  if (!manifest.allowed_origins.includes(origin)) {
    manifest.allowed_origins.push(origin);
    writeFileSync(HOST_MANIFEST, JSON.stringify(manifest, null, 2));
  }
}

/**
 * The extension next to the desktop app, with fake desktop biometrics. They talk over native
 * messaging, like an installed pair:
 *
 *   extension ──connectNative──▶ desktop_proxy ──IPC socket (.debug/e2e)──▶ desktop main
 */
export const test = mergeTests(browserTest, biometricsTest).extend({
  nativeMessaging: NativeMessaging.Granted,
  // Depends on `context` so Chromium and its profile exist before desktop writes the manifest.
  extraEnv: async ({ extraEnv, context }, use) => {
    void context;
    await use({ ...extraEnv, BITWARDEN_CHROME_PROFILE_DIR: CHROME_PROFILE_DIR });
  },
  app: async ({ app, context }, use) => {
    await allowExtension(context);
    await use(app);
  },
});

export { expect } from "@playwright/test";
