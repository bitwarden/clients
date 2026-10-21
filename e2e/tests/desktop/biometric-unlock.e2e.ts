import { clickMenuItem, MenuItem } from "../../src/desktop/app-menu";
import { BiometricRequestType, test } from "../../src/desktop/biometrics";
import { expect } from "../../src/desktop/fixtures";
import { LoginPage } from "../../src/login";

const VAULT_URL = /#\/vault/;
const LOCK_URL = /#\/lock/;

test("enrolls in biometric unlock, locks and unlocks with biometrics", async ({
  app,
  window,
  biometrics,
}) => {
  const login = new LoginPage(window);
  await login.logIn();
  await login.waitForVault(VAULT_URL);

  // Enrolling stores the key with the fake right away; it raises no prompt to approve.
  await clickMenuItem(app, MenuItem.Settings);
  const settings = window.getByRole("dialog");
  const toggle = settings.getByTestId("settings-biometric-checkbox");
  await toggle.check();
  await biometrics.waitUntilEnrolled();
  await window.keyboard.press("Escape");

  // Locking turns auto-prompt off, so unlock waits for the button.
  await clickMenuItem(app, MenuItem.LockAll);
  await window.waitForURL(LOCK_URL);

  const unlock = window.getByTestId("lock-biometric-unlock-button");
  await expect(unlock).toBeEnabled();
  await unlock.click();
  await biometrics.approveNext(BiometricRequestType.Unlock);

  await window.waitForURL(VAULT_URL);
  await expect(unlock).toBeHidden();
});
