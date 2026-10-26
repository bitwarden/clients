import { AccountSecurityPage } from "../../../src/browser/account-security";
import { lockNow as lockExtensionNow } from "../../../src/browser/account-switcher";
import { test } from "../../../src/browser/fixtures";
import { account } from "../../../src/credentials";
import { FeatureFlag } from "../../../src/feature-flags";
import { LockScreen } from "../../../src/lock-screen";
import {
  Extension,
  LOCK_URL,
  lockExtension,
  logInToExtension,
  logInToWeb,
  openExtensionVault,
  SYNC_TIMEOUT_MS,
} from "../../../src/shared/clients";
import { lockNow as lockWebNow } from "../../../src/web/account-menu";

/**
 * Web vault and extension lock and unlock together ("Sync unlock with web app", on by default).
 * Both run in one Chromium context; the extension's content script carries the IPC.
 */

const FLAGS = [FeatureFlag.SharedUnlock, FeatureFlag.ContentScriptIpc];
const PIN = "1234";

test.describe("shared unlock between web vault and extension", () => {
  test.setTimeout(300_000);

  let extension: Extension;

  test.beforeEach(async ({ context, popup }) => {
    extension = await logInToExtension(context, popup, FLAGS);

    const settings = new AccountSecurityPage(extension.popup);
    await settings.open(extension.url);
    await settings.expectWebSync();
    await openExtensionVault(extension);
  });

  test("locking the extension locks the web vault, unlocking the web vault unlocks the extension", async ({
    context,
  }) => {
    const web = await logInToWeb(context);

    extension = await lockExtension(context, extension, () => lockExtensionNow(extension.popup));
    await web.waitForURL(LOCK_URL, { timeout: SYNC_TIMEOUT_MS });

    const extensionLock = new LockScreen(extension.popup);
    await extensionLock.waitUntilShown();

    await new LockScreen(web).unlockWithMasterPassword(account().password);
    await extensionLock.waitUntilGone();
  });

  test("locking the web vault locks the extension, unlocking the extension unlocks the web vault", async ({
    context,
  }) => {
    const web = await logInToWeb(context);

    extension = await lockExtension(context, extension, () => lockWebNow(web));
    const webLock = new LockScreen(web);
    await webLock.waitUntilShown();

    await new LockScreen(extension.popup).unlockWithMasterPassword(account().password);
    await webLock.waitUntilGone();
  });

  test("unlocking the extension with a PIN unlocks the web vault", async ({ context }) => {
    const settings = new AccountSecurityPage(extension.popup);
    await settings.open(extension.url);
    await settings.setPin(PIN);
    const web = await logInToWeb(context);

    extension = await lockExtension(context, extension, () => lockWebNow(web));
    const webLock = new LockScreen(web);
    await webLock.waitUntilShown();

    await new LockScreen(extension.popup).unlockWithPin(PIN);
    await webLock.waitUntilGone();
  });
});
