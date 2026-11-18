import { enableEphemeralPin } from "../../../src/browser/account-security";
import { addAccount, lockAll, switchAccount } from "../../../src/browser/account-switcher";
import { expect, test } from "../../../src/browser/fixtures";
import { account, secondAccount } from "../../../src/credentials";
import { LockScreen } from "../../../src/lock-screen";
import { LoginPage } from "../../../src/login";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;
const PIN = "1234";

test("keeps an inactive account's ephemeral PIN when locking all accounts", async ({
  context,
  popup,
}) => {
  const pinUser = secondAccount();
  const login = new LoginPage(popup);

  // Given an account with an ephemeral PIN, unlocked in this session
  await login.logIn(pinUser);
  await login.waitForVault(VAULT_URL);
  await enableEphemeralPin(popup, PIN);

  // And an active account without a PIN
  await addAccount(popup);
  await login.logIn(account());
  await login.waitForVault(VAULT_URL);

  // When the user locks all accounts
  const lockedPopup = await lockAll(context, popup);

  // Then the PIN account still unlocks with its PIN
  await switchAccount(lockedPopup, pinUser.email);
  const lockScreen = new LockScreen(lockedPopup);
  await lockScreen.waitUntilShown();
  await expect(lockScreen.pinInput).toBeVisible();
  await lockScreen.unlockWithPin(PIN);
  await new LoginPage(lockedPopup).waitForVault(VAULT_URL);
});
