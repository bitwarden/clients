import { clientAccounts } from "../../../src/accounts";
import { AccountSecurityPage } from "../../../src/browser/account-security";
import { expect, popupUrl, reachLoginPage, test } from "../../../src/browser/fixtures";
import { lockScreen, LockScreenOutcome } from "../../../src/browser/system-events";
import { LoginPage } from "../../../src/login";
import {
  SessionTimeout,
  SessionTimeoutAction,
  SessionTimeoutSettings,
  storedSessionTimeoutAction,
} from "../../../src/session-timeout";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;

test("keeps the Log out timeout action through a system lock while logged out", async ({
  context,
  popup,
}) => {
  test.setTimeout(180_000);

  // Given a user who logs out on system lock
  const login = new LoginPage(popup);
  await login.logIn();
  await login.waitForVault(VAULT_URL);
  const [{ userId }] = await clientAccounts(popup);

  await new AccountSecurityPage(popup).open(await popupUrl(context));
  const sessionTimeout = new SessionTimeoutSettings(popup);
  await sessionTimeout.setTimeout(SessionTimeout.OnSystemLock);
  await sessionTimeout.setAction(SessionTimeoutAction.LogOut);
  await expect
    .poll(() => storedSessionTimeoutAction(popup, userId))
    .toBe(SessionTimeoutAction.LogOut);

  // When the system locks, which logs the user out
  const loggedOutPopup = await lockScreen(context, popup, LockScreenOutcome.Restart);
  // The reopened popup attaches the automation driver only once it has started.
  await reachLoginPage(loggedOutPopup);

  // And the system locks again before the user logs back in
  await lockScreen(context, loggedOutPopup, LockScreenOutcome.NoRestart);

  // Then after logging back in, the timeout action is still Log out
  const relogin = new LoginPage(loggedOutPopup);
  await relogin.logIn();
  await relogin.waitForVault(VAULT_URL);
  expect(await storedSessionTimeoutAction(loggedOutPopup, userId)).toBe(
    SessionTimeoutAction.LogOut,
  );

  // And the next system lock logs the user out instead of locking the vault
  const finalPopup = await lockScreen(context, loggedOutPopup, LockScreenOutcome.Restart);
  await new LoginPage(finalPopup).waitUntilShown();
  expect((await clientAccounts(finalPopup))[0]?.status).toBe("LoggedOut");
});
