import { lockAndReopen } from "../../src/browser/account-switcher";
import { test } from "../../src/browser/fixtures";
import { AccountName, account } from "../../src/credentials";
import { LockScreen } from "../../src/lock-screen";
import { LoginPage, ServerChoice } from "../../src/login";
import { measureLockCycles, reportLockCycles } from "../../src/perf";

/**
 * Lock is timed from clicking "Lock now" until a reopened popup shows the lock screen,
 * which includes the extension restart lock performs.
 */

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;
const LOCK_URL = /#\/lock/;

test("measures lock and master password unlock", async ({ context, popup: firstPopup }) => {
  test.setTimeout(300_000);

  const user = account(AccountName.Usdev);
  const login = new LoginPage(firstPopup);
  await login.logIn(user, ServerChoice.Selectable);
  await login.waitForVault(VAULT_URL);

  // Each lock restarts the extension, so every cycle continues in a new popup.
  let popup = firstPopup;

  const cycles = await measureLockCycles(
    async () => {
      popup = await lockAndReopen(context, popup);
      await popup.waitForURL(LOCK_URL);
      await new LockScreen(popup).waitUntilShown();
    },
    async () => {
      await new LockScreen(popup).unlockWithMasterPassword(user.password);
      await popup.waitForURL(VAULT_URL);
    },
  );

  reportLockCycles("browser", cycles);
});
