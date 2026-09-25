import { AccountName, account } from "../../src/credentials";
import { clickMenuItem, MenuItem } from "../../src/desktop/app-menu";
import {
  AUTOMATION_BIOMETRICS_ENV,
  Biometrics,
  BiometricRequestType,
  biometricUnlockLabel,
} from "../../src/desktop/biometrics";
import { expect, test } from "../../src/desktop/fixtures";
import { LoginPage, ServerChoice } from "../../src/login";

/**
 * Needs a development build, the only kind that honors the fake biometrics:
 *
 *   npm run build:dev --workspace @bitwarden/desktop
 *
 * Development builds also skip the lock-time renderer reload, so one page spans the test.
 */

const VAULT_URL = /#\/vault/;
const LOCK_URL = /#\/lock/;

test.use({ extraEnv: AUTOMATION_BIOMETRICS_ENV });

test("enrolls in biometric unlock, locks and unlocks with biometrics", async ({ app, window }) => {
  const biometrics = new Biometrics(window);
  const label = biometricUnlockLabel();

  const login = new LoginPage(window);
  await login.logIn(account(AccountName.Usdev), ServerChoice.Selectable);
  await login.waitForVault(VAULT_URL);

  // Enrolling stores the key with the fake right away; it raises no prompt to approve.
  await clickMenuItem(app, MenuItem.Settings);
  const settings = window.getByRole("dialog");
  const toggle = settings.getByRole("checkbox", { name: label });
  await toggle.check();
  // The dialog unchecks the toggle again when enrolling fails.
  await expect(toggle).toBeChecked();
  await window.keyboard.press("Escape");
  await expect(settings).toBeHidden();

  // Locking turns auto-prompt off, so unlock waits for the button.
  await clickMenuItem(app, MenuItem.LockAll);
  await window.waitForURL(LOCK_URL);
  const unlock = window.getByRole("button", { name: label });
  await expect(unlock).toBeEnabled();

  await unlock.click();
  await biometrics.approveNext(BiometricRequestType.Unlock);

  await window.waitForURL(VAULT_URL);
  await expect(unlock).toBeHidden();
});
