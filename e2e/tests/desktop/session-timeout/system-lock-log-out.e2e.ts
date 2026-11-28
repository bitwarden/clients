import { clientAccounts } from "../../../src/accounts";
import { expect, test } from "../../../src/desktop/fixtures";
import { watchReload } from "../../../src/desktop/lock";
import { DesktopSettings } from "../../../src/desktop/settings";
import { lockScreen } from "../../../src/desktop/system-events";
import { LoginPage } from "../../../src/login";
import {
  SessionTimeout,
  SessionTimeoutAction,
  SessionTimeoutSettings,
  storedSessionTimeoutAction,
} from "../../../src/session-timeout";

const VAULT_URL = /#\/vault/;

test("keeps the Log out timeout action through a system lock while logged out", async ({
  app,
  window,
}) => {
  test.setTimeout(180_000);

  // Given a user who logs out on system lock
  await new LoginPage(window).logIn();
  await new LoginPage(window).waitForVault(VAULT_URL);
  const [{ userId }] = await clientAccounts(window);

  const settings = new DesktopSettings(app, window);
  await settings.open();
  const sessionTimeout = new SessionTimeoutSettings(window);
  await sessionTimeout.setTimeout(SessionTimeout.OnSystemLock);
  await sessionTimeout.setAction(SessionTimeoutAction.LogOut);
  await expect
    .poll(() => storedSessionTimeoutAction(window, userId))
    .toBe(SessionTimeoutAction.LogOut);
  await settings.close();

  // When the system locks, which logs the user out and reloads the renderer
  const logOutReload = watchReload(window);
  await lockScreen(app);
  const loggedOutWindow = await logOutReload();
  const login = new LoginPage(loggedOutWindow);
  // The reloaded renderer handles system events only once it has started.
  await login.waitUntilShown();

  // And the system locks again before the user logs back in
  await lockScreen(app);

  // Then after logging back in, the timeout action is still Log out
  await login.logIn();
  await login.waitForVault(VAULT_URL);
  expect(await storedSessionTimeoutAction(loggedOutWindow, userId)).toBe(
    SessionTimeoutAction.LogOut,
  );

  // And the next system lock logs the user out instead of locking the vault
  const nextReload = watchReload(loggedOutWindow);
  await lockScreen(app);
  const finalWindow = await nextReload();
  await new LoginPage(finalWindow).waitUntilShown();
  expect((await clientAccounts(finalWindow))[0]?.status).toBe("LoggedOut");
});
