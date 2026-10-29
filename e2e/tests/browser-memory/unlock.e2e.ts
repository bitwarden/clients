import { Page } from "@playwright/test";

import { dismissAnnouncement } from "../../src/announcements";
import { enablePin } from "../../src/browser/account-security";
import { lockAndReopen } from "../../src/browser/account-switcher";
import { popupUrl, reachLoginPage } from "../../src/browser/fixtures";
import { test } from "../../src/browser/memory/fixtures";
import {
  measurePopupOpens,
  measureUnlocks,
  reportTimings,
  trackUnlocks,
} from "../../src/browser/memory/unlock-timing";
import { account } from "../../src/credentials";
import { disableFlags, FeatureFlag } from "../../src/feature-flags";
import { LockScreen, TEST_PIN } from "../../src/lock-screen";
import { LoginPage } from "../../src/login";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;
const TEST_TIMEOUT_MS = 15 * 60_000;
// Login syncs and decrypts the whole vault, which takes a while on a large one.
const LOGIN_TIMEOUT_MS = 5 * 60_000;

/**
 * Time from an unlock click to the vault list's first paint (the popup's `Vault rendered`
 * mark), and from opening the popup while unlocked to that paint. Results land in
 * `.debug/e2e/memory/<E2E_MEMORY_LABEL>/unlock.json`.
 *
 * Biometric unlock is not measured: in the extension it runs through the desktop app over
 * native messaging.
 */
test.describe("unlock performance", () => {
  let popup: Page;

  test.beforeEach(async ({ context }) => {
    test.setTimeout(TEST_TIMEOUT_MS);

    popup = await context.newPage();
    await popup.goto(await popupUrl(context));
    await reachLoginPage(popup);
    await disableFlags(popup, [FeatureFlag.PasswordPreloginFromSdk]);
    await new LoginPage(popup).logIn();
    await popup.waitForURL(VAULT_URL, { timeout: LOGIN_TIMEOUT_MS });
    await dismissAnnouncement(popup);
    await trackUnlocks(popup);
  });

  test("master password", async ({ context }) => {
    // Locking restarts the extension, so each run unlocks in a freshly opened popup.
    let page = popup;
    const durations = await measureUnlocks(
      async () => (page = await lockAndReopen(context, page)),
      (lockScreen) => new LockScreen(lockScreen).unlockWithMasterPassword(account().password),
    );

    reportTimings("master password", durations);
  });

  test("pin", async ({ context }) => {
    await enablePin(context, popup, TEST_PIN);

    let page = popup;
    const durations = await measureUnlocks(
      async () => (page = await lockAndReopen(context, page)),
      (lockScreen) => new LockScreen(lockScreen).unlockWithPin(TEST_PIN),
    );

    reportTimings("pin", durations);
  });

  test("popup open while unlocked", async ({ context }) => {
    const url = await popupUrl(context);
    await popup.close();

    const durations = await measurePopupOpens(async () => {
      const page = await context.newPage();
      await page.goto(url);
      return page;
    });

    reportTimings("popup open while unlocked", durations);
  });
});
