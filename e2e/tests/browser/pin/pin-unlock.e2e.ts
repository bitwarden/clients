import { AccountSecurityPage } from "../../../src/browser/account-security";
import { lockAndReopen } from "../../../src/browser/account-switcher";
import { expect, popupUrl, test } from "../../../src/browser/fixtures";
import { LockScreen } from "../../../src/lock-screen";
import { LoginPage } from "../../../src/login";
import { openExtensionVault } from "../../../src/shared/clients";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;
const PIN = "1234";

test("unlocks with a PIN once it is fully typed", async ({ context, popup }) => {
  const login = new LoginPage(popup);

  // Given a logged in user with a PIN
  await login.logIn();
  await login.waitForVault(VAULT_URL);
  const url = await popupUrl(context);
  const settings = new AccountSecurityPage(popup);
  await settings.open(url);
  await settings.setPin(PIN);
  await openExtensionVault({ popup, url });

  // When the vault locks
  const lockedPopup = await lockAndReopen(context, popup);
  const lockScreen = new LockScreen(lockedPopup);
  await lockScreen.waitUntilShown();
  await expect(lockScreen.pinInput).toBeVisible();

  // Then typing the PIN unlocks it, without pressing Unlock
  await lockScreen.unlockWithPin(PIN);
  await new LoginPage(lockedPopup).waitForVault(VAULT_URL);
});
