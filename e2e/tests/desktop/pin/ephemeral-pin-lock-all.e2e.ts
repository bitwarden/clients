import { account, secondAccount } from "../../../src/credentials";
import { addAccount, switchAccount } from "../../../src/desktop/account-switcher";
import { expect, test } from "../../../src/desktop/fixtures";
import { lockAll, LockOutcome } from "../../../src/desktop/lock";
import { enableEphemeralPin } from "../../../src/desktop/settings";
import { LockScreen } from "../../../src/lock-screen";
import { LoginPage } from "../../../src/login";

const VAULT_URL = /#\/vault/;
const PIN = "1234";

test("keeps an inactive account's ephemeral PIN when locking all accounts", async ({
  app,
  window,
}) => {
  const pinUser = secondAccount();
  const login = new LoginPage(window);

  // Given an account with an ephemeral PIN, unlocked in this session
  await login.logIn(pinUser);
  await login.waitForVault(VAULT_URL);
  await enableEphemeralPin(app, window, PIN);

  // And an active account without a PIN
  await addAccount(window);
  await login.logIn(account());
  await login.waitForVault(VAULT_URL);

  // When the user locks all accounts, which must not reload: that would wipe the PIN
  const lockedWindow = await lockAll(app, window, LockOutcome.NoReload);

  // Then the PIN account still unlocks with its PIN
  await switchAccount(lockedWindow, pinUser.email);
  const lockScreen = new LockScreen(lockedWindow);
  await expect(lockScreen.pinInput).toBeVisible();
  await lockScreen.unlockWithPin(PIN);
  await new LoginPage(lockedWindow).waitForVault(VAULT_URL);
});
