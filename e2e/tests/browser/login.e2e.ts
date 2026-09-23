import { expect, test } from "../../src/browser/fixtures";
import { AccountName, account } from "../../src/credentials";
import { LoginPage, ServerChoice } from "../../src/login";

// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const VAULT_URL = /#\/tabs\//;

test("logs into the vault with a master password", async ({ popup }) => {
  const login = new LoginPage(popup);
  await login.logIn(account(AccountName.Usdev), ServerChoice.Selectable);
  await login.waitForVault(VAULT_URL);

  await expect(popup.getByTestId("login-master-password-input")).toBeHidden();
});
