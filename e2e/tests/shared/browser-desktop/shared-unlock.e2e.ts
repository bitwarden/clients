import { AccountSecurityPage } from "../../../src/browser/account-security";
import { lockNow as lockExtensionNow } from "../../../src/browser/account-switcher";
import { account } from "../../../src/credentials";
import { clickMenuItem, MenuItem } from "../../../src/desktop/app-menu";
import { BiometricRequestType } from "../../../src/desktop/biometrics";
import { DesktopSettings } from "../../../src/desktop/settings";
import { enableFlags, FeatureFlag } from "../../../src/feature-flags";
import { LockScreen } from "../../../src/lock-screen";
import { LoginPage } from "../../../src/login";
import {
  DESKTOP_VAULT_URL,
  desktopConnected,
  Extension,
  LOCK_URL,
  lockExtension,
  logInToExtension,
  openExtensionVault,
  SYNC_TIMEOUT_MS,
} from "../../../src/shared/clients";
import { expect, test } from "../../../src/shared/desktop-fixtures";

/**
 * Extension and desktop app lock and unlock together ("Sync unlock with desktop app"), and the
 * extension unlocks with the desktop app's biometrics. Biometrics go over SDK IPC.
 */

const FLAGS = [FeatureFlag.SharedUnlock, FeatureFlag.BiometricsSdkIpc];
const PIN = "1234";
// LockComponent refreshes its unlock options every second; one more covers the 500 ms status query.
const LOCK_SCREEN_POLL_MS = 2_000;

test.describe("shared unlock between extension and desktop app", () => {
  test.setTimeout(300_000);

  let extension: Extension;

  test.beforeEach(async ({ context, popup, window }) => {
    await enableFlags(window, FLAGS);
    const desktopLogin = new LoginPage(window);
    await desktopLogin.logIn();
    await desktopLogin.waitForVault(DESKTOP_VAULT_URL);

    extension = await logInToExtension(context, popup, FLAGS);
    const settings = new AccountSecurityPage(extension.popup);
    await settings.open(extension.url);
    await settings.enableDesktopSync();
    await openExtensionVault(extension);
  });

  test("locking desktop locks the extension, unlocking desktop unlocks the extension", async ({
    app,
    context,
    window,
  }) => {
    extension = await lockExtension(context, extension, () => clickMenuItem(app, MenuItem.LockAll));
    const extensionLock = new LockScreen(extension.popup);
    await extensionLock.waitUntilShown();
    await window.waitForURL(LOCK_URL);

    await new LockScreen(window).unlockWithMasterPassword(account().password);
    await extensionLock.waitUntilGone();
  });

  test("locking the extension locks desktop, unlocking the extension unlocks desktop", async ({
    context,
    window,
  }) => {
    extension = await lockExtension(context, extension, () => lockExtensionNow(extension.popup));
    await window.waitForURL(LOCK_URL, { timeout: SYNC_TIMEOUT_MS });
    const desktopLock = new LockScreen(window);
    await desktopLock.waitUntilShown();

    await new LockScreen(extension.popup).unlockWithMasterPassword(account().password);
    await desktopLock.waitUntilGone();
  });

  test("unlocking desktop with a PIN unlocks the extension", async ({ app, context, window }) => {
    const settings = new DesktopSettings(app, window);
    await settings.open();
    await settings.setPin(PIN);
    await settings.close();

    extension = await lockExtension(context, extension, () => clickMenuItem(app, MenuItem.LockAll));
    const extensionLock = new LockScreen(extension.popup);
    await extensionLock.waitUntilShown();

    await new LockScreen(window).unlockWithPin(PIN);
    await extensionLock.waitUntilGone();
  });

  test("unlocking the extension with a PIN unlocks desktop", async ({ app, context, window }) => {
    const settings = new AccountSecurityPage(extension.popup);
    await settings.open(extension.url);
    await settings.setPin(PIN);

    extension = await lockExtension(context, extension, () => clickMenuItem(app, MenuItem.LockAll));
    const desktopLock = new LockScreen(window);
    await desktopLock.waitUntilShown();

    await new LockScreen(extension.popup).unlockWithPin(PIN);
    await desktopLock.waitUntilGone();
  });

  test("unlocks the extension with desktop biometrics", async ({
    app,
    biometrics,
    context,
    window,
  }) => {
    const settings = new DesktopSettings(app, window);
    await settings.open();
    await settings.enableBiometrics(biometrics);
    await settings.close();

    extension = await lockExtension(context, extension, () => clickMenuItem(app, MenuItem.LockAll));
    const desktopLock = new LockScreen(window);
    await desktopLock.waitUntilShown();

    // Biometrics is the default option once desktop reports it available.
    const extensionLock = new LockScreen(extension.popup);
    const unlock = extensionLock.biometricUnlockButton();
    await expect(unlock).toBeEnabled({ timeout: SYNC_TIMEOUT_MS });
    await unlock.click();
    await biometrics.approveNext(BiometricRequestType.Unlock);

    await extensionLock.waitUntilGone();
    await desktopLock.waitUntilGone();
  });

  test("shows biometrics unavailable when desktop has them off", async ({ app, context }) => {
    const connected = desktopConnected(context);
    extension = await lockExtension(context, extension, () => clickMenuItem(app, MenuItem.LockAll));
    const extensionLock = new LockScreen(extension.popup);
    await extensionLock.waitUntilShown();

    // Disconnected looks the same as unavailable; only a connected desktop's answer counts.
    // The lock screen polls every second.
    await connected();
    await extension.popup.waitForTimeout(LOCK_SCREEN_POLL_MS);

    // Desktop reports NotEnabledInConnectedDesktopApp: offered, but disabled. A status the
    // extension cannot explain hides the option instead.
    const swap = extensionLock.biometricSwapButton();
    await expect(swap).toBeVisible();
    await expect(swap).toBeDisabled();
    await expect(extensionLock.biometricUnlockButton()).toBeHidden();

    await extensionLock.unlockWithMasterPassword(account().password);
  });
});
